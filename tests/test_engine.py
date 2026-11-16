import unittest, os, subprocess, shutil
from engine import fulfill, script, audio

OK = "Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant, nous allons répondre."
resp = lambda t: (lambda p: {"content": [{"text": t}]})

class T(unittest.TestCase):
    def test_validate(self):
        self.assertTrue(script.validate(OK, "Dupont Plomberie", "", "accueil"))
        for bad in ["Court.", OK + " Appelez le 0612345678.", OK + " Voir www.x.fr", OK + " [nom]", " ".join(["mot"] * 100)]:
            with self.assertRaises(ValueError): script.validate(bad, "Dupont Plomberie", "", "accueil")
        self.assertTrue(script.validate(OK + " Ouvert de 9 heures à 18 heures.", "X", "lundi 9h-18h", "horaires"))
    def test_clean_injection(self):
        self.assertNotIn("<", script.clean("a<b>{x}", 60))
        self.assertEqual(len(script.clean("x" * 999, 60)), 60)
    def test_generate(self):
        self.assertEqual(script.generate("Dupont Plomberie", "accueil", "", post=resp(OK)), OK)
    def test_plan(self):
        pack = {"custom_fields": [{"key": "voix", "type": "dropdown", "dropdown": {"value": "m"}}]}
        self.assertEqual(fulfill.plan(pack), [("accueil", "m"), ("horaires", "m"), ("attente", "m")])
        one = {"custom_fields": [{"key": "message", "type": "dropdown", "dropdown": {"value": "fermeture_f"}}]}
        self.assertEqual(fulfill.plan(one), [("fermeture", "f")])
        with self.assertRaises(ValueError): fulfill.plan({"custom_fields": [{"key": "message", "type": "dropdown", "dropdown": {"value": "x_f"}}]})
    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg absent")
    def test_wav(self):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=1", "/tmp/t.mp3"], check=True)
        w = audio.to_wav_pbx(open("/tmp/t.mp3", "rb").read())
        self.assertTrue(w.startswith(b"RIFF"))
    def _sess(self, fields):
        return {"id": "cs_1", "payment_status": "paid", "payment_intent": "pi_1", "customer_details": {"email": "c@x.fr"}, "custom_fields": fields}
    def _stripe(self, session, pi):
        def stripe(method, path, params=None):
            if path == "checkout/sessions": return {"data": [session]}
            if method == "POST":
                for k, v in params.items(): pi["metadata"][k[9:-1]] = str(v)
            return pi
        return stripe
    def test_pipeline_idempotent(self):
        os.environ.update(REVIEW_MODE="0", ELEVENLABS_VOICE_F="vf", ELEVENLABS_VOICE_M="vm")
        sent, pi = [], {"id": "pi_1", "metadata": {}}
        s = self._sess([{"key": "entreprise", "type": "text", "text": {"value": "Dupont Plomberie"}},
                        {"key": "voix", "type": "dropdown", "dropdown": {"value": "f"}}])
        kw = dict(stripe=self._stripe(s, pi), gen=lambda c, m, i: OK, tts=lambda t, v: b"MP3", wav=lambda m: b"WAV",
                  send=lambda *a, **k: sent.append(a))
        self.assertEqual(fulfill.run(**kw), (1, 0)); self.assertEqual(fulfill.run(**kw), (0, 0))
        self.assertEqual(len(sent), 1); self.assertEqual(sent[0][0], "c@x.fr"); self.assertEqual(len(sent[0][3]), 6)
    def test_review_mode_goes_to_owner(self):
        os.environ.update(REVIEW_MODE="1", OWNER_EMAIL="o@x.fr", ELEVENLABS_VOICE_F="vf")
        sent, pi = [], {"id": "pi_1", "metadata": {}}
        s = self._sess([{"key": "message", "type": "dropdown", "dropdown": {"value": "accueil_f"}}])
        fulfill.run(stripe=self._stripe(s, pi), gen=lambda c, m, i: OK, tts=lambda t, v: b"MP3", wav=lambda m: None, send=lambda *a, **k: sent.append(a))
        self.assertEqual(sent[0][0], "o@x.fr")
    def test_failure_alerts_after_retries(self):
        os.environ.update(REVIEW_MODE="0", OWNER_EMAIL="o@x.fr")
        sent, pi = [], {"id": "pi_1", "metadata": {}}
        def boom(*a): raise RuntimeError("api down")
        st = self._stripe(self._sess([]), pi)
        for _ in range(4): fulfill.run(stripe=st, gen=boom, send=lambda *a, **k: sent.append(a))
        self.assertEqual(len(sent), 1); self.assertIn("ALERTE", sent[0][1])
if __name__ == "__main__": unittest.main()
