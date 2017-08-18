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
        const ret = qsts.map(item => ({ "question": qstMap[item.key], "count": item.count }));
        console.log("successfully get result");
        return ret;
    }
}