import json, sys
d = json.load(open("public/vo-words.json"))
w = [(x["word"].lower().strip(".,!?—"), x["start"], x["end"]) for x in d["words"]]
def find(word, after=0.0, nth=1):
    n = 0
    for x, s, e in w:
        if x.startswith(word) and s >= after:
            n += 1
            if n == nth:
                return s
    raise SystemExit(f"missing {word}")
t = {}
t["pages"] = find("pages")
t["covered"] = find("are", 2.0)
t["overpaying"] = find("are", t["covered"] + 0.5)
t["meet"] = find("meet")
t["reads"] = find("reads") - 0.15
t["market"] = find("watches")
t["life"] = find("life")
t["notices"] = find("notices")
t["overpay"] = find("when")
t["swarm"] = find("swarm")
t["deal"] = find("same")
t["brand"] = find("service", t["deal"])
t["voEnd"] = w[-1][2]
json.dump(t, open("src/timing.json", "w"), indent=1)
print(t)
