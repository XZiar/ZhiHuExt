"use strict"


/**
 * @param {...BagArray} voters
 */
async function StatVoters(...voters)
{
    console.log("arrive voters", voters);
    const bag = voters.filter(v => v != null).reduce((prev, cur) => prev.union(cur), new SimpleBag());
    const uids = bag.elements();

    /**@type {{[x:string]: User}}*/
    const usrMap = await doAnalyse("getDetailMapOfIds", "users", uids, "id");

    let sum = 0;

    const data = bag.map((uid, count) =>
    {
        const user = usrMap[uid];
        if (user.status === "ban" || user.status === "sban")
            sum += count;
        return { usr: { name: user.name, id: user.id }, status: user.status, artcnt: user.artcnt, anscnt: user.anscnt, follower: user.follower, count: count };
    });
    $("#banzansum").text(sum);
    $("#maintable").DataTable(
        {
            paging: true,
            lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
            data: data,
            order: [[5, "desc"]],
            columns:
            [
                {
                    data: "usr",
                    render: displayRender(dat => `<a class="bgopen" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>`)
                },
                {
                    data: "status",
                    render: displayRender(dat => dat === "ban" ? "停用" : (dat === "sban" ? "永禁言" : "正常？")),
                },
                { data: "artcnt" },
                { data: "anscnt" },
                { data: "follower" },
                { data: "count" }
            ]
        });
}

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    let voters;

    if (qs.uid != null)
    {
        const uids = qs.uid.split("*");
        const [artids, ansids] = await Promise.all([getIdByAuthor(uids, "article"), getIdByAuthor(uids, "answer")]);
        voters = await Promise.all([getVoters(artids, "article"), getVoters(ansids, "answer")]);
    }
    else if (qs.qid != null)
    {
        const qids = qs.qid.split("*").map(Number);
        const anss = await doAnalyse("getAnswerByQuestion", qids);
        voters = [await getVoters(anss.mapToProp("id"), "answer")];
    }
    if (voters != null)
        StatVoters(...voters);
}()

