"use strict"

class Analyse
{
    static async findQuestOfUserVote(uids)
    {
        console.log("here [" + uids.length + "] uids");
        const zans = await db.zans.where("from").anyOf(BAN_UID).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanAnss = new SimpleBag(zans.mapToProp("to")).toArray();
        console.log("reduce to [" + zanAnss.length + "] answers");
        const ansMap = {};
        await db.answers.where("id").anyOf(zanAnss.mapToProp("key"))
            .each(ans => ansMap[ans.id] = ans.question);
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const questBag = new SimpleBag();
        zanAnss.forEach(zanans => questBag.addMany(ansMap[zanans.key], zanans.count));
        const qsts = questBag.toArray("desc");
        console.log("reduce to [" + qsts.length + "] questions");
        const qstMap = {};
        await db.questions.where("id").anyOf(qsts.mapToProp("key"))
            .each(qst => qstMap[qst.id] = qst);
        console.log("get [" + Object.keys(qstMap).length + "] questions");
        const ret = qsts.map(item =>
        {
            const qst = qstMap[item.key];
            return { "question": qst === undefined ? item.key : qst, "count": item.count };
        });
        console.log("successfully get result");
        return ret;
    }
    static async findAuthorOfUserVote(uids)
    {
        console.log("here [" + uids.length + "] uids");
        const zans = await db.zans.where("from").anyOf(BAN_UID).toArray();
        console.log("get [" + zans.length + "] zans");
        const zanAnss = new SimpleBag(zans.mapToProp("to")).toArray();
        console.log("reduce to [" + zanAnss.length + "] answers");
        const ansMap = {};
        await db.answers.where("id").anyOf(zanAnss.mapToProp("key"))
            .each(ans => ansMap[ans.id] = ans.author);
        console.log("get [" + Object.keys(ansMap).length + "] answers");
        const authorBag = new SimpleBag();
        zanAnss.forEach(zanans => authorBag.addMany(ansMap[zanans.key], zanans.count));
        const aths = authorBag.toArray("desc");
        console.log("reduce to [" + aths.length + "] authors");
        const athMap = {};
        await db.users.where("id").anyOf(aths.mapToProp("key"))
            .each(ath => athMap[ath.id] = ath);
        console.log("get [" + Object.keys(athMap).length + "] authors");
        const ret = aths.map(item =>
        {
            const ath = athMap[item.key];
            return { "user": ath === undefined ? item.key : ath, "count": item.count };
        });
        console.log("successfully get result");
        return ret;
    }
}