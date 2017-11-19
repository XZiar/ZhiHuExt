"use strict"
//import { Dexie } from "./dexie.min.js"


async function toNameMap(prop)
{
    const result = {};
    await this.each(obj => result[obj[prop]] = obj);
    return result;
}
async function toPropMap(keyProp, valProp)
{
    const result = {};
    await this.each(obj => result[obj[keyProp]] = obj[valProp]);
    return result;
}
if (typeof Dexie !== "undefined")
{
    Dexie.addons.push(x => x.Collection.prototype.toNameMap = toNameMap);
    Dexie.addons.push(x => x.Collection.prototype.toPropMap = toPropMap);
}

var BAN_UID = new Set();
var SPAM_UID = new Set();

class ZhiHuDB
{
    /**
     * @template T
     * @param {string} table
     * @param {T[]} items
     */
    static insertfix(table, items)
    {
        /**@type {Map<string, T>}*/
        const tmpmap = new Map();
        switch (table)
        {
            case "zans":
            case "zanarts":
                for (let i = 0; i < items.length; ++i)
                {
                    const zan = items[i];
                    const id = zan.from + "," + zan.to;
                    const last = tmpmap.get(id);
                    if (last == null)
                        tmpmap.set(id, zan);
                    else if (last.time === -1)
                        last.time = zan.time;
                }
                break;
            case "topics":
            case "spams":
                return items;//skip
            default:
                for (let i = 0; i < items.length; ++i)
                {
                    const item = items[i];
                    const id = item.id;
                    const last = tmpmap.get(id);
                    if (last != null)
                    {
                        const entries = Object.entries(last);
                        for (let i = 0; i < entries.length; ++i)
                        {
                            const [key, val] = entries[i];
                            if (val === -1 || val === null)
                                last[key] = item[key];
                        }
                    }
                    else
                        tmpmap.set(id, item);
                }
        }
        return Array.from(tmpmap.values());
    }

    static hook(thedb)
    {
        thedb.spams.hook("creating", (primKey, obj, trans) =>
        {
            if (obj.type === "member")
                SPAM_UID.add(obj.id);
        });
        thedb.users.hook("creating", (primKey, obj, trans) =>
        {
            if (obj.status === null)
                obj.status = "";
            else if (obj.status === "ban" || obj.status === "sban")
                BAN_UID.add(obj.id);
        });
        thedb.users.hook("updating", (mods, primKey, obj, trans) =>
        {
            const keys = Object.keys(mods);
            if (keys.length === 0) return;
            const ret = {};
            {
                if (mods.status === "ban" || mods.status === "sban")
                    BAN_UID.add(obj.id);
                else if (mods.status === "")
                    BAN_UID.delete(obj.id);
            }
            for (let idx = 0; idx < keys.length; idx++)
            {
                const key = keys[idx], val = mods[key];
                if ((val === -1 || val === null))
                    if (obj.hasOwnProperty(key))
                        ret[key] = obj[key];//skip unset values
            }
            //console.log("compare", mods, ret);
            return ret;
        });
        thedb.zans.hook("updating", (mods, primKey, obj, trans) =>
        {
            if (mods.time === -1)
                return { time: obj.time };//skip empty time
            return;
        });
        thedb.zanarts.hook("updating", (mods, primKey, obj, trans) =>
        {
            if (mods.time === -1)
                return { time: obj.time };//skip empty time
            return;
        });
        thedb.articles.hook("updating", (mods, primKey, obj, trans) =>
        {
            const keys = Object.keys(mods);
            if (keys.length === 0) return;
            const ret = {};
            for (let idx = 0; idx < keys.length; idx++)
            {
                const key = keys[idx], val = mods[key];
                if ((val === -1 || val === null))
                    ret[key] = obj[key];//skip unset values
            }
            return ret;
        });
        thedb.answers.hook("updating", (mods, primKey, obj, trans) =>
        {
            const keys = Object.keys(mods);
            if (keys.length === 0) return;
            const ret = {};
            for (let idx = 0; idx < keys.length; idx++)
            {
                const key = keys[idx], val = mods[key];
                if ((val === -1 || val === null))
                    ret[key] = obj[key];//skip unset values
            }
            return ret;
        });
        thedb.questions.hook("creating", (primKey, obj, trans) =>
        {
            if (obj.topics === null)
                obj.topics = [];
        });
        thedb.questions.hook("updating", (mods, primKey, obj, trans) =>
        {
            const hasModTopic = Object.keys(mods).find(key => key.startsWith("topics."));
            const ret = {};
            if (mods.timeC === -1)
                ret.timeC = obj.timeC;
            if (!mods.topics && !hasModTopic)
                ret.topics = obj.topics;
            return ret;
        });
    }

    /**
     * @param {string} dbname
     * @param {{[x:string]: string}[]} def
     * @param {function(any):void[]} upgrader
     * @param {function():void} onDone
     */
    constructor(dbname, def, upgrader, onDone)
    {
        /**@type {{[x:string]: {}}}*/
        this.db = new Dexie(dbname);
        for (let v = 0; v < def.length; ++v)
        {
            const st = this.db.version(v + 1).stores(def[v])
            if (upgrader[v])
                st.upgrade(upgrader[v]);
        }
        ZhiHuDB.hook(this.db);
        this.db.open()
            .then(onDone)
            .catch(e => console.error("cannot open db", e));
        for (const table in def[def.length - 1])
            this[table] = this.db[table];
    }

    /**
     * @param {string} target
     * @param {object | object[]} data
     * @param {function(number):void} [notify]
     */
    insert(target, data, notify)
    {
        if (target === "batch")
        {
            let sum = 0;
            Object.entries(data).forEach(([key, val]) => sum += this.insert(key, val));
            if (notify)
                notify(sum);
            return sum;
        }
        const table = this.db[target];
        if (!table)
        {
            console.warn("unknown table", target, data);
            return 0;
        }
        let pms;
        let count = 0;
        if (!(data instanceof Array))
        {
            count = 1;
            pms = table.put(data);
        }
        else if (data.length > 0)
        {
            data = ZhiHuDB.insertfix(target, data);
            count = data.length;
            pms = table.bulkPut(data);
        }
        else
            return 0;
        pms.catch(error => console.warn("[insert] failed!", error, target, data));
        if (notify)
            notify(count);
        return count;
    }
    /**
     * @param {string} target
     * @param {{obj: object | object[], key: string, updator: object}} data
     */
    update(target, data)
    {
        const table = this.db[target];
        if (!table)
            return false;
        console.log("updateDB", target, data);
        let matchs;
        if (data.obj instanceof Array)
            matchs = table.where(data.key).anyOf(data.obj);
        else
            matchs = table.where(data.key).equals(data.obj);
        matchs.modify(match => Object.assign(match, data.updator))
            .catch(error => console.warn("[update] failed!", error, target, data));
        return true;
    }
    async count()
    {
        const ret = { ban: BAN_UID.size };
        /**@type {Promise<void>[]}*/
        const tabpmss = this.db.tables.map(async table =>
        {
            ret[table.name] = await table.count();
            console.log("table counted", table.name);
        });
        await Promise.all(tabpmss);
        return ret;
    }
    export()
    {
        const pms = $.Deferred();
        this.db.transaction("r", this.db.tables, () =>
        {
            const ret = {};
            const tabpmss = this.db.tables.map(async table =>
            {
                ret[table.name] = await table.toArray();
                console.log("export table [" + table.name + "] success");
            });
            Promise.all(tabpmss)
                .then(() => pms.resolve(ret))
                .catch(e => pms.reject(e));
        });
        return pms;
    }
    /**
     * @param {string} table
     * @param {number} from
     * @param {number} count
     * @returns {Promise<string> | Promise<string[]>}
     */
    async part(table, from, count)
    {
        if (table == null)
            return this.db.tables.mapToProp("name");
        return JSON.stringify(await this.db[table].offset(from).limit(count).toArray());
    }



    /**
     * @param {string} table
     * @param {[] | Promise<any>} id
     * @param {string} prop
     * @returns {{[x:any]: any}}
     */
    async getPropMapOfIds(table, id, prop)
    {
        const ids = await toPureArray(id);
        const retMap = await this.db[table].where("id").anyOf(ids).toPropMap("id", prop);
        return retMap;
    }
    /**
     * @param {string} table
     * @param {any} id
     * @param {string} name
     * @returns {{[id:string]: object}}
     */
    async getDetailMapOfIds(table, id, name)
    {
        const ids = await toPureArray(id);
        const retMap = await this.db[table].where("id").anyOf(ids).toNameMap(name);
        return retMap;
    }
    /**
     * @param {number | number[] | BagArray | Promise<Any>} id
     * @param {"answer" | "article"} target
     * @returns {Promise<BagArray>}
     */
    async getVoters(id, target)
    {
        const ids = await toPureArray(id);
        console.log(`here [${ids.length}] ${target} ids`);
        const table = (target === "answer" ? this.db.zans : this.db.zanarts);
        /**@type {Zan[]}*/
        const zans = await table.where("to").anyOf(ids).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanUsers = new SimpleBag(zans.mapToProp("from")).toArray("desc");
        return zanUsers;
    }
    /**
     * @param {string | string[] | BagArray | Promise<Any>} uid
     * @param {"answer" | "article"} target
     * @param {"desc" | "asc"} [order]
     * @returns {Promise<BagArray>}
     */
    async getIdByVoter(uid, target, order)
    {
        const uids = await toPureArray(uid);
        console.log("here [" + uids.length + "] uids");
        const table = (target === "answer" ? this.db.zans : this.db.zanarts);
        const zans = await table.where("from").anyOf(uids).toArray();
        console.log(`here [${zans.length}] ${target} zans`);
        const ids = new SimpleBag(zans.mapToProp("to"));
        return ids.toArray(order);
    }
    /**
     * @param {string | string[] | BagArray | Promise<Any>} uid
     * @param {"answer" | "article"} target
     * @returns {Promise<number[]>}
     */
    async getIdByAuthor(uid, target)
    {
        const uids = await toPureArray(uid);
        console.log("here [" + uids.length + "] uids");
        const table = (target === "answer" ? this.db.answers : this.db.articles);
        const ids = await table.where("author").anyOf(uids).primaryKeys();
        console.log(`here [${ids.length}] ${target} ids`);
        return ids;
    }
    async getAnsIdByVoter(uid, order)
    {
        const uids = await toPureArray(uid);
        console.log("here [" + uids.length + "] uids");
        const zans = await this.db.zans.where("from").anyOf(uids).toArray();
        console.log("get [" + zans.length + "] zans");
        const ansids = new SimpleBag(zans.mapToProp("to")).toArray(order);
        console.log("reduce to [" + ansids.length + "] answers");
        return ansids;
    }
    async getAnswerByQuestion(qsts)
    {
        const qids = await toPureArray(qsts);
        console.log("here [" + qids.length + "] qids");
        const answers = await this.db.answers.where("question").anyOf(qids).toArray();
        console.log("get [" + answers.length + "] questions");
        return answers;
    }
    async getAnsIdByQuestion(qsts)
    {
        const qids = await toPureArray(qsts);
        console.log("here [" + qids.length + "] qids");
        const ansids = await this.db.answers.where("question").anyOf(qids).primaryKeys();
        console.log("get [" + ansids.length + "] questions");
        return ansids;
    }
    async getQuestIdByAnswer(anss)
    {
        const ansMap = await getPropMapOfIds("answers", anss, "question");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const ansarray = await toSimpleBagArray(anss);
        const questBag = new SimpleBag();
        ansarray.forEach(ans => questBag.addMany(ansMap[ans.key], ans.count));
        const qsts = questBag.toArray("desc");
        console.log("reduce to [" + qsts.length + "] questions");
        return qsts;
    }

}




