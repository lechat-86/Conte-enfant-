import unittest, os
from engine import fulfill, story, tts, mail

FAKE_TEXT = "TITRE: Léa et la lune\n\n" + "\n\n".join(["Léa regarde la lune douce et ronde. " * 12] * 10)

class T(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(story.clean_name("léa<script>"), "Léascript")
        self.assertEqual(story.clean_name(""), "Le petit héros")
        self.assertEqual(story.clean_age("99"), 10)
        self.assertEqual(story.clean_age(None), 5)
    def test_parse_rejects(self):
        with self.assertRaises(ValueError): story.parse("TITRE: x\n\ncourt")
        with self.assertRaises(ValueError): story.parse(FAKE_TEXT + " le sang")
    def test_generate_mock(self):
        title, body = story.generate("Léa", 5, "noir", api_key="x", post=lambda p: {"content": [{"text": FAKE_TEXT}]})
        self.assertEqual(title, "Léa et la lune")
    def test_chunks(self):
        self.assertTrue(all(len(c) < 3200 for c in tts.chunks(FAKE_TEXT)))
    def test_pipeline_idempotent(self):
        sent, pis = [], {"pi_1": {"id": "pi_1", "metadata": {}}}
        session = {"id": "cs_1", "payment_status": "paid", "payment_intent": "pi_1",
                   "customer_details": {"email": "p@x.fr"},
                   "custom_fields": [{"key": "prenom", "type": "text", "text": {"value": "Léa"}},
                                     {"key": "age", "type": "numeric", "numeric": {"value": "4"}},
                                     {"key": "situation", "type": "dropdown", "dropdown": {"value": "noir"}}]}
        def stripe(method, path, params=None):
            if path == "checkout/sessions": return {"data": [session]}
            pi = pis[path.split("/")[1]]
            if method == "POST":
                for k, v in params.items(): pi["metadata"][k[9:-1]] = str(v)
            return pi
        os.environ["REVIEW_MODE"] = "0"
        gen = lambda n, a, t: story.generate(n, a, t, api_key="x", post=lambda p: {"content": [{"text": FAKE_TEXT}]})
        kw = dict(stripe=stripe, gen=gen, voice=lambda t, b: b"MP3", send=lambda *a, **k: sent.append(a))
        self.assertEqual(fulfill.run(**kw), (1, 0))
        self.assertEqual(fulfill.run(**kw), (0, 0))   # pas de double livraison
        self.assertEqual(len(sent), 1); self.assertEqual(sent[0][0], "p@x.fr")
    def test_failure_retries_then_alerts(self):
        sent, pi = [], {"id": "pi_1", "metadata": {}}
        session = {"id": "cs_1", "payment_status": "paid", "payment_intent": "pi_1", "customer_details": {"email": "p@x.fr"}, "custom_fields": []}
        def stripe(method, path, params=None):
            if path == "checkout/sessions": return {"data": [session]}
            if method == "POST":
                for k, v in params.items(): pi["metadata"][k[9:-1]] = str(v)
            return pi
        os.environ["REVIEW_MODE"] = "0"; os.environ["OWNER_EMAIL"] = "o@x.fr"
        def boom(*a): raise RuntimeError("api down")
        for _ in range(4): fulfill.run(stripe=stripe, gen=boom, voice=None, send=lambda *a, **k: sent.append(a))
        self.assertEqual(len(sent), 1); self.assertIn("ALERTE", sent[0][1])
if __name__ == "__main__": unittest.main()
