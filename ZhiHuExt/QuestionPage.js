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
        const qstArea = $(".QuestionHeader-footer .QuestionButtonGroup")
        if (qstArea.length > 0)
        {
            const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
            btn.dataset.id = qid;
            btn.dataset.type = "question";
            qstArea.prepend(btn);
        }
    }, 800);
}()
