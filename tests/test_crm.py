import importlib.util, os, tempfile, unittest, io, contextlib
spec = importlib.util.spec_from_file_location("crm", os.path.join(os.path.dirname(__file__), "..", "tools", "crm.py"))
crm = importlib.util.module_from_spec(spec); spec.loader.exec_module(crm)

class T(unittest.TestCase):
    def setUp(self):
        d = tempfile.mkdtemp(); crm.CSV = f"{d}/p.csv"; crm.OPTOUT = f"{d}/o.txt"
    def run_(self, *a):
        out = io.StringIO()
        with contextlib.redirect_stdout(out): crm.main(list(a))
        return out.getvalue()
    def test_flow(self):
        self.run_("add", "Dupont", "--email", "J@dupont.fr", "--prenom", "Jean", "--secteur", "plombier", "--type", "nominative", "--source", "leur site")
        self.assertIn("à contacter", self.run_("next"))
        self.assertIn("NON envoyé", self.run_("draft", "1"))
        txt = open(os.path.join(crm.ROOT, "drafts", "1_email_1.txt"), encoding="utf-8").read()
        for must in ["STOP", "CNIL", "j@dupont.fr", "Dupont"]: self.assertIn(must, txt)
        self.run_("mark", "1", "contacte"); self.assertIn("rien", self.run_("next"))
        self.assertIn("contactés 1", self.run_("stats"))
    def test_optout_blocks(self):
        self.run_("add", "X", "--email", "a@x.fr", "--type", "nominative"); self.run_("optout", "a@x.fr")
        with self.assertRaises(SystemExit): self.run_("draft", "1")
        with self.assertRaises(SystemExit): self.run_("add", "Y", "--email", "A@x.fr", "--type", "nominative")
    def test_personal_address_refused(self):
        self.run_("add", "X", "--email", "a@gmail.com", "--type", "personnelle")
        with self.assertRaises(SystemExit): self.run_("draft", "1")
if __name__ == "__main__": unittest.main()
