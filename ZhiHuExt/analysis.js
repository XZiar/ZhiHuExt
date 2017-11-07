"use strict"

function tryReplaceDetailed(bagArray, detailMap, newProp)
{
    const ret = [];
    for (let i = 0; i < bagArray.length; ++i)
    {
        const item = bagArray[i];
        const res = { "count": item.count };
        const key = item.key;
        const detail = detailMap[key];
        res[newProp] = (detail === undefined ? key : detail);
        ret.push(res);
    }
    return ret;
}

class Analyse
{
    static get STR_AUTHOR()
    { return 'Analyse.findAuthorOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.user instanceof Object?y.user.name+"  ===  "+y.user.id+"  ===  "+y.user.status:"    ===  "+y.user))))'; }
    static get STR_QUEST()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.question instanceof Object?y.question.title+"  ===  "+y.question.id:"   ===  "+y.question))))'; }
    static get STR_TOPIC()
    { return 'Analyse.findTopicOfUserVote(BAN_UID).then(x=>console.log(x.map(y=>y.count+" --- "+(y.topic instanceof Object?y.topic.name+"  ===  "+y.topic.id:"   ===  "+y.topic))))'; }
    static get STR_QST_URL()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>hurls=x.map(y=>"https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question)))'; }
    static get STR_MISS_TOPIC()
    { return 'Analyse.findQuestOfUserVote(BAN_UID).then(x=>console.log(x.filter(y=>y.question instanceof Object?!(y.question.topics||y.question.topics.length>0):true).map(y=>y.count+" --- https://www.zhihu.com/question/"+(y.question instanceof Object?y.question.id:y.question))))'; }

    /**
     * @param {Promise<Any> | Set<Any> | SimpleBag | Any[]} dat
     * @returns {Promise<Any[]>}
     */
    static async toPureArray(dat)
    {
        const dat0 = dat instanceof Promise ? await dat : dat;
        const dat1 = dat0 instanceof Set ? dat0.toArray() : dat0;
        const dat2 = dat1 instanceof SimpleBag ? dat1.toArray() : dat1;
        const dat3 = dat2 instanceof Array ? dat2 : [dat2];
        const dat4 = dat3[0].hasOwnProperty("count") ? dat3.mapToProp("key") : dat3;
        return dat4;
    }
    /**
     * @param {Promise<Any> | SimpleBag | Any[]} dat
     * @returns {Promise<{key: Any, count: number}[]>}
     */
    static async toSimpleBagArray(dat)
    {
        const dat0 = dat instanceof Promise ? await dat : dat;
        const dat1 = dat0 instanceof SimpleBag ? dat0.toArray() : dat0;
        const dat2 = dat1 instanceof Array ? dat1 : [dat1];
        const dat3 = dat2[0].hasOwnProperty("count") ? dat3 : dat3.map(x => ({ key: x, count: 1 }));
        return dat3;
    }
    /**@param {string | object} table*/
    static toTable(table)
    {
        if (typeof (table) === "string")
            return db[table];
        else
            return table;
    }

    static async getSpamBanId(uid)
    {
        const uids = await Analyse.toPureArray(uid);
        const spams = await db.spams.where("type").equals("member").primaryKeys();
        return (new Set([...spams, ...uids])).toArray();
    }
    static async getPropMapOfIds(tab, id, prop)
    {
        const ids = await Analyse.toPureArray(id);
        const table = Analyse.toTable(tab);
        const retMap = await table.where("id").anyOf(ids).toPropMap("id", prop);
        return retMap;
    }
    /**
     * @param {string | object} tab
     * @param {any} id
     * @param {string} name
     * @returns {{[id:string]: object}}
     */
    static async getDetailMapOfIds(tab, id, name)
    {
        const table = Analyse.toTable(tab);
        const ids = await Analyse.toPureArray(id);
        const retMap = await table.where("id").anyOf(ids).toNameMap(name);
        return retMap;
    }
    static async getAnsVoters(ansid)
    {
        const ansids = await Analyse.toPureArray(ansid);
        console.log("here [" + ansids.length + "] ansids");
        const zans = await db.zans.where("to").anyOf(ansids).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanUsers = new SimpleBag(zans.mapToProp("from")).toArray("desc");
        return zanUsers;
    }
    static async getAnswerByAuthor(uid)
    {
        const uids = await Analyse.toPureArray(uid);
        console.log("here [" + uids.length + "] uids");
        const ansids = await db.answers.where("id").anyOf(uids).primaryKeys();
        console.log("here [" + ansids.length + "] ansids");
        return ansids;
    }
    static async getAnswerByVoter(uid, order)
    {
        const uids = await Analyse.toPureArray(uid);
        console.log("here [" + uids.length + "] uids");
        const zans = await db.zans.where("from").anyOf(uids).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanAnss = new SimpleBag(zans.mapToProp("to")).toArray(order);
        console.log("reduce to [" + zanAnss.length + "] answers");
        return zanAnss;
    }
    static async getQuestIdByAnswer(anss)
    {
        const ansMap = await Analyse.getPropMapOfIds(db.answers, anss, "question");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const ansarray = await Analyse.toSimpleBagArray(anss);
        const questBag = new SimpleBag();
        ansarray.forEach(ans => questBag.addMany(ansMap[ans.key], ans.count));
        const qsts = questBag.toArray("desc");
        console.log("reduce to [" + qsts.length + "] questions");
        return qsts;
    }

    static async findQuestOfUserVote(uid)
    {
        const zanAnss = await Analyse.getAnswerByVoter(uid);
        const qsts = await Analyse.getQuestIdByAnswer(zanAnss);
        const qstMap = await Analyse.getDetailMapOfIds(db.questions, qsts, "id");
        console.log("get [" + Object.keys(qstMap).length + "] questions");
        return tryReplaceDetailed(qsts, qstMap, "question");
    }
    static async findAuthorOfUserVote(uid)
    {
        const zanAnss = await Analyse.getAnswerByVoter(uid);
        const ansMap = await Analyse.getPropMapOfIds(db.answers, zanAnss, "author");
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const authorBag = new SimpleBag();
        zanAnss.forEach(zanans => authorBag.addMany(ansMap[zanans.key], zanans.count));
        const aths = authorBag.toArray("desc");
        console.log("reduce to [" + aths.length + "] authors");
        const athMap = await Analyse.getDetailMapOfIds(db.users, aths, "id");
        console.log("get [" + Object.keys(athMap).length + "] authors");
        return tryReplaceDetailed(aths, athMap, "user");
    }
    static async findSimilarUserOfAnswerVote(ansid)
    {
        const zanUsers = await Analyse.getAnsVoters(ansid);
        const userMap = await Analyse.getDetailMapOfIds(db.users, zanUsers, "id");
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(zanUsers, userMap, "user");
    }
    static async findSimilarUserInAnsOfAnswerVote(objAns, refAns)
    {
        const zanUsers = await Analyse.getAnsVoters(refAns);
        const objUsers = new Set((await db.zans.where("to").equals(objAns).toArray()).mapToProp("from"));
        console.log("get [" + objUsers.size + "] obj voters");
        const resUsers = zanUsers.filter(usr => objUsers.has(usr.key));
        console.log("restrict to [" + resUsers.length + "] target voters");
        const userMap = await Analyse.getDetailMapOfIds(db.users, resUsers, "id");
        console.log("get [" + Object.keys(userMap).length + "] users");
        return tryReplaceDetailed(resUsers, userMap, "user");
    }
    static async findTopicOfUserVote(uid)
    {
        const quests = await Analyse.getAnswerByVoter(uid);
        const topicBag = new SimpleBag();
        quests.forEach(quest =>
        {
            if (quest.question instanceof Object)
                quest.question.topics.forEach(tid => topicBag.addMany(tid, quest.count));
        });
        const tps = topicBag.toArray("desc");
        console.log("reduce to [" + tps.length + "] topics");
        const topicMap = await Analyse.getDetailMapOfIds(db.topics, tps, "id");
        console.log("get [" + Object.keys(topicMap).length + "] topics");
        return tryReplaceDetailed(tps, topicMap, "topic");
    }
}