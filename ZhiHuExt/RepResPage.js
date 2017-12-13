"use strict"

!function ()
{
    console.log("report-result page");

    /**
     * @param {HTMLElement[]} feedbackNodes
     */
    function addQuickCheckBtns(feedbackNodes)
    {
        feedbackNodes.filter(node => !node.hasChild(".Btn-QCheckStatus"))
            .forEach(node =>
            {
                const hrefNode = Array.from(node.children[1].querySelectorAll("a"))
                    .filter(aNode => aNode.href.includes("/people/"))[0];
                if (!hrefNode)
                    return;
                const btnNode = node.children[2];
                const btn = createButton(["Btn-QCheckStatus"], "检测");
                btn.dataset.id = hrefNode.href.split("/").pop();
                btn.dataset.name = hrefNode.text;
                btnNode.insertBefore(btn, btnNode.children[1]);
            });
    }

    const bodyObserver = new MutationObserver(records =>
    {
        const addNodes = Array.fromArray(records
            .map(record => $.makeArray(record.addedNodes)
                .filter(node => node instanceof HTMLDivElement)
            ));
        const feedbackNodes = $(addNodes).filter(".zm-pm-item").toArray()
            .filter(ele => ele.dataset.name === "知乎管理员" && ele.dataset.type === "feedback");
        if (feedbackNodes.length > 0)
            addQuickCheckBtns(feedbackNodes);
    });
    async function onChkStatus(e)
    {
        const btn = e.target;
        const uid = btn.dataset.id;
        const user = await ContentBase.checkUserState(uid, undefined, [50], true);
        if (!user)
            return;
        if (user.status === "ban" || user.status === "sban")
        {
            btn.style.background = "black";
        }
        else
        {
            btn.style.background = "rgb(0,224,32)";
        }
    }
    $("body").on("click", "button.Btn-QCheckStatus", onChkStatus);
    $("body").on("click", "button.Btn-QCheckStatusAll", async function (e)
    {
        const thisbtn = e.target;
        /**@type {HTMLButtonElement[]}*/
        const btns = $("button.Btn-QCheckStatus", document).toArray()
            .filter(x => x.style.background === "");
        for (let i = 0; i < btns.length; ++i)
        {
            thisbtn.textContent = btns[i].dataset.name;
            await Promise.all([onChkStatus({ target: btns[i] }), _sleep(1000)]);
        }
        thisbtn.textContent = "检测全部";
    });


    const chkAll = createButton(["Btn-QCheckStatusAll"], "检测全部");
    const dummydiv = document.createElement("div");
    dummydiv.style.textAlign = "center";
    dummydiv.appendChild(chkAll);
    $("#zh-pm-detail-item-wrap").prepend(dummydiv);

    const curNodes = $(".zm-pm-item", document).toArray();
    addQuickCheckBtns(curNodes);

    bodyObserver.observe(document.body, { "childList": true, "subtree": true });

}()