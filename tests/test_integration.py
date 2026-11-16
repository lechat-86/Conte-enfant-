"""Teste le VRAI code réseau (urllib, SMTP, ffmpeg) contre des serveurs locaux imitant Stripe, Anthropic, ElevenLabs et SMTP.
Aucun paiement réel, aucun envoi réel."""
import json, os, shutil, socketserver, subprocess, tempfile, threading, time, unittest, email
from http.server import BaseHTTPRequestHandler, HTTPServer
from email import policy
from engine import fulfill, followup, report

HAVE_FFMPEG = shutil.which("ffmpeg")
TEXT = "Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant, nous allons répondre."
STATE = {"pi": {"metadata": {}}, "calls": [], "mails": []}

def tone_mp3():
    d = tempfile.mkdtemp(); f = f"{d}/t.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=300:d=3", f], check=True)
    return open(f, "rb").read()

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype="application/json"):
        self.send_response(code); self.send_header("content-type", ctype); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        STATE["calls"].append(("GET", self.path))
        if self.path.startswith("/v1/checkout/sessions"):
            sess = {"id": "cs_1", "payment_status": "paid", "payment_intent": "pi_1", "amount_total": 3900, "client_reference_id": "agence-x",
                    "customer_details": {"email": "client@example.fr"},
                    "custom_fields": [{"key": "entreprise", "type": "text", "text": {"value": "Dupont Plomberie"}},
                                      {"key": "voix", "type": "dropdown", "dropdown": {"value": "m"}},
                                      {"key": "infos", "type": "text", "text": {"value": "lundi au vendredi 8h-18h"}}]}
            return self._send(200, json.dumps({"data": [sess]}).encode())
        if self.path == "/v1/user/subscription":
            return self._send(200, json.dumps({"tier": "starter", "status": "active", "character_count": 100, "character_limit": 30000}).encode())
        if self.path.startswith("/v1/voices/"):
            cat = "premade" if self.path.endswith("voice-f") else "professional"
            return self._send(200, json.dumps({"name": "Test", "category": cat, "verified_languages": [{"language": "fr"}]}).encode())
        if self.path.startswith("/v1/payment_intents/"):
            return self._send(200, json.dumps({"id": "pi_1", "metadata": STATE["pi"]["metadata"]}).encode())
        self._send(404, b"{}")
    def do_POST(self):
        n = int(self.headers.get("content-length", 0)); body = self.rfile.read(n).decode()
        STATE["calls"].append(("POST", self.path))
        if self.path.startswith("/v1/payment_intents/"):
            from urllib.parse import parse_qsl
            for k, v in parse_qsl(body): STATE["pi"]["metadata"][k[9:-1]] = v
            return self._send(200, b"{}")
        if self.path.startswith("/v1/messages"):
            assert self.headers["x-api-key"] == "test-claude"
            return self._send(200, json.dumps({"content": [{"text": TEXT}]}).encode())
        if self.path.startswith("/v1/text-to-speech/"):
            assert self.headers["xi-api-key"] == "test-eleven"
            payload = json.loads(body); assert "language_code" not in payload   # multilingual_v2 : pas de language_code
            STATE["voice"] = self.path.split("/")[3].split("?")[0]
            return self._send(200, tone_mp3(), "audio/mpeg")
        self._send(404, b"{}")

class SMTPH(socketserver.StreamRequestHandler):
    def handle(self):
        w = lambda s: (self.wfile.write((s + "\r\n").encode()), self.wfile.flush())
        w("220 test"); data = False; buf = []
        while True:
            line = self.rfile.readline()
            if not line: return
            l = line.decode(errors="replace")
            if data:
                if l == ".\r\n":
                    STATE["mails"].append("".join(buf)); buf = []; data = False; w("250 ok")
                else: buf.append(l[1:] if l.startswith("..") else l)
                continue
            c = l[:4].upper()
            if c in ("EHLO", "HELO"): w("250 test")
            elif c in ("MAIL", "RCPT"): w("250 ok")
            elif c == "DATA": data = True; w("354 go")
            elif c == "QUIT": w("221 bye"); return
            else: w("250 ok")

class Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = HTTPServer(("127.0.0.1", 0), H); cls.smtp = socketserver.ThreadingTCPServer(("127.0.0.1", 0), SMTPH)
        for s in (cls.http, cls.smtp): threading.Thread(target=s.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{cls.http.server_address[1]}"
        os.environ.update(STRIPE_BASE=base, ANTHROPIC_BASE=base, ELEVENLABS_BASE=base, STRIPE_SECRET_KEY="sk_test", ANTHROPIC_API_KEY="test-claude",
            ELEVENLABS_API_KEY="test-eleven", ELEVENLABS_VOICE_F="voice-f", ELEVENLABS_VOICE_M="voice-m", SMTP_HOST="127.0.0.1",
            SMTP_PORT=str(cls.smtp.server_address[1]), SMTP_SECURITY="none", SMTP_FROM="shop@example.fr", OWNER_EMAIL="owner@example.fr", REVIEW_URL="https://example.fr/avis")
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.smtp.shutdown()
    @unittest.skipUnless(HAVE_FFMPEG, "ffmpeg absent")
    def test_end_to_end_real_http_smtp_ffmpeg(self):
        os.environ["REVIEW_MODE"] = "0"
        self.assertEqual(fulfill.run(), (1, 0))
        self.assertEqual(STATE["voice"], "voice-m")                      # voix masculine demandée
        self.assertEqual(fulfill.run(), (0, 0))                          # pas de double livraison
        self.assertEqual(len(STATE["mails"]), 1)
        msg = email.message_from_string(STATE["mails"][0], policy=policy.default)
        self.assertEqual(msg["To"], "client@example.fr")
        names = sorted(p.get_filename() for p in msg.iter_attachments())
        self.assertEqual(names, ["accueil.mp3", "accueil_standard-8khz.wav", "attente.mp3", "attente_standard-8khz.wav", "horaires.mp3", "horaires_standard-8khz.wav"])
        wav = [p for p in msg.iter_attachments() if p.get_filename().endswith(".wav")][0].get_payload(decode=True)
        from engine import audio; self.assertGreater(audio.validate_wav(wav), 2)
        self.assertEqual(STATE["pi"]["metadata"]["delivered"], "1")
    def test_followup_and_report(self):
        STATE["mails"].clear(); os.environ["REVIEW_MODE"] = "0"
        old = lambda: time.time() + 8 * 86400                           # on avance le temps de 8 jours
        STATE["pi"]["metadata"]["delivered"] = "1"
        # le faux Stripe renvoie toujours la session : la relance part une seule fois
        self.assertEqual(followup.run(now=old), 1); self.assertEqual(followup.run(now=old), 0)
        self.assertIn("avis", STATE["mails"][0].lower())
        n, ca, refs = report.summary()
        self.assertEqual((n, ca, refs), (1, 39.0, {"agence-x": (1, 39.0)}))
    def test_doctor(self):
        import importlib.util, io, contextlib
        spec = importlib.util.spec_from_file_location("doctor", os.path.join(os.path.dirname(__file__), "..", "tools", "doctor.py"))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        out = io.StringIO()
        with contextlib.redirect_stdout(out): code = m.main([])
        self.assertEqual(code, 0); self.assertIn("À VÉRIFIER", out.getvalue()); self.assertIn("starter", out.getvalue())
if __name__ == "__main__": unittest.main()
