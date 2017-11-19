"use strict"

!function ()
{
    console.log("question page");
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
        }
    });
    obs.observe(document, { "childList": true, "subtree": true });
    setTimeout(() =>
    {
        const qid = document.location.pathname.split("/")[2];
        if (!qid)
            return;
        const qstArea = $("div.QuestionHeader-footer-inner").find("div.QuestionButtonGroup")
        if (qstArea.length > 0)
        {
            const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
            btn.dataset.id = qid;
            btn.dataset.type = "question";
            const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "最爱赞");
            btn2.dataset.id = qid;
            btn2.dataset.qname = "qid";
            const btn3 = createButton(["Btn-AssocAns", "Button--primary"], "启发");
            btn3.dataset.id = qid;
            btn3.dataset.qname = "qid";
            qstArea.prepend(btn);
            qstArea.prepend(btn2);
            qstArea.prepend(btn3);
        }
    }, 800);
}()
