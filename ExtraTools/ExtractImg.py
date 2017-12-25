import base64
import codecs
import json


odir = input("output dir path:")

while True:
    fpath = input("object file path:")
    with open(fpath, "r", encoding="utf8") as fp:
        dat = json.load(fp)
    cnt = 0
    for imgname, b64str in dat["images"].items():
        opath = odir + "/" + imgname
        b64parts = b64str.split(",")
        if len(b64parts) != 2: continue
        b64 = b64parts[1].encode()
        with open(opath, "wb") as fp:
            fp.write(base64.b64decode(b64))
            pass
        print("write image:", imgname)
        cnt += 1
        pass
    print("{} images writted.".format(cnt))

