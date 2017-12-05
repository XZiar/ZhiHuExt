"use strict"

!function ()
{
    "use strict"
    console.log("people page");
    function rootFinder(records)
    {
        for (let i = 0; i < records.length; ++i)
        {
            const record = records[i];
            if (record.type != "childList")
                continue;
            const nodes = record.addedNodes;
            for (let j = 0; j < nodes.length; ++j)
            {
                const node = nodes[j];
                if (!(node instanceof Element))
                    continue;
                if (node.id === "data")
                    return node;
                const obj = node.querySelector("#data");
                if (obj)
                    return obj;
            }
        }
        return null;
    }
    const obs = new MutationObserver(records =>
    {
        const obj = rootFinder(records);
        if (!obj)
            return;
        obs.disconnect();
        const state = JSON.parse(obj.dataset.state);
        console.log(state);
        {
            const entities = APIParser.parseEntities(state.entities);
            ContentBase._report("batch", entities);
            console.log(entities);
            //process user
            const uid = document.location.pathname.split("/")[2];
            if (!uid)
                return;
            ContentBase.CUR_USER = entities.users.filter(u => u.id === uid)[0];

            ContentBase.CUR_TOKEN = new UserToken(state.token);
            console.log(ContentBase.CUR_USER);
        }
    });
    obs.observe(document, { "childList": true, "subtree": true });

    setTimeout(() =>
    {
        $("body").on("click", ".Btn-AutoActSpider", async e =>
        {
            const thisbtn = e.target;
            const uid = thisbtn.dataset.id;
            const ret = await ContentBase.fetchUserActs(uid, e.ctrlKey ? 70 : 5, undefined, undefined,
                (cur, time) => thisbtn.innerText = cur + "/" + Date.fromUTCSeconds(time).Format("MMdd"));
            const acts = ret.acts.selfMerge();
            thisbtn.innerText = (acts.zans.length + acts.zanarts.length) + "赞";
            ContentBase._report("batch", acts);
            console.log(acts);
        });

        const user = ContentBase.CUR_USER;
        const header = $("#ProfileHeader")[0];
        if (!user || !header)
            return;
        const btn1 = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn1.dataset.id = user.id;
        btn1.dataset.type = "member";
        const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "粉丝");
        btn2.dataset.id = user.id;
        btn2.dataset.qname = "athid";
        const btn3 = createButton(["Btn-StatVoter", "Button--primary"], "赞谁");
        btn3.dataset.id = user.id;
        btn3.dataset.qname = "uid";
        const btn4 = createButton(["Btn-AutoActSpider", "Button--primary"], "爬");
        btn4.dataset.id = user.id;
        if (!header.hasChild(".ProfileButtonGroup"))
        {
            const dummydiv = document.createElement("div");
            dummydiv.className = "MemberButtonGroup ProfileButtonGroup ProfileHeader-buttons";
            $(".ProfileHeader-contentFooter", header).append(dummydiv);
        }
        $(".ProfileButtonGroup", header).prepend(btn1, btn2, btn3, btn4);
    }, 640);
}()
