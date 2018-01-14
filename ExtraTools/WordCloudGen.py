import codecs
import json

fpath = input("object file path:")

with open(fpath, "r", encoding="utf8") as fp:
    dat = json.load(fp)

mode = input("1.jieba\t2.23grams:")
output = []

def extractgram(txt:str):
    mode = 0 # normal
    output = False;
    str = []
    for ch in txt:
        pass


extractgram(234)

if mode == 1:
    import jieba
    newdat = [tk for name in dat for tk in jieba.cut(name.lower(), cut_all=False)]
else:
    pass

with open("namestk.json", "w") as fp:
    json.dump(newdatoutput, fp)