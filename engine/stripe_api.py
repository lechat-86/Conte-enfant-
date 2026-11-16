import json, os, urllib.parse, urllib.request, base64

def call(method, path, params=None, key=None):
    key = key or os.environ["STRIPE_SECRET_KEY"]
    url = os.environ.get("STRIPE_BASE", "https://api.stripe.com") + "/v1/" + path
    data = None
    if params:
        enc = urllib.parse.urlencode(params, doseq=True)
        if method == "GET": url += "?" + enc
        else: data = enc.encode()
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": "Basic " + base64.b64encode((key + ":").encode()).decode()})
    return json.load(urllib.request.urlopen(req, timeout=60))
