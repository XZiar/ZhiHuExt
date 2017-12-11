"use strict"


function reportSpam(id, type)
{
    const payload = { "resource_id": id, "type": type, "reason_type": "spam", "source": "web" };
    //req.setRequestHeader("Referer", "https://www.zhihu.com/people/" + id + "/activities");
    const pms = $.Deferred();
    ContentBase._post("https://www.zhihu.com/api/v4/reports", payload)
        .done((data, status, xhr) =>
        {
            if (xhr.status === 204 || xhr.status === 200)
            {
                pms.resolve();
                ContentBase._report("spams", { id: id, type: type });
            }
        })
        .fail((data, status, xhr) =>
        {
            if (data.responseJSON)
                pms.reject({ code: data.responseJSON.error.code, error: data.responseJSON.error.message });
            else
                pms.reject({ code: xhr.status, error: "unknown error" });
        })
    return pms;
}


let CUR_ANSWER = null;
let CUR_ARTICLE = null;
let LIM_FetchVoter = 20000;
const BLOCKING_FLAG = createButton([])
BLOCKING_FLAG.style.display = "none";
BLOCKING_FLAG.id = "ZHE_BLOCKING_VOTER";

function setLimVoter(count)
{
    console.log(`set Voter Fetch Limit from ${LIM_FetchVoter} to ${count}`);
    LIM_FetchVoter = count;
}

async function autoReportAll(ev)
{
    ev.preventDefault();
    const thisbtn = ev.target;
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    let report;
    let type;
    if (txt.includes("http"))
    {
        const mth1 = txt.match(/zhihu.com\/question\/\d*\/answer\/(\d*)/i);
        const mth2 = txt.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
        const mth3 = txt.match(/www.zhihu.com\/people\/([^\/]*)/i);
        if (mth1)
        {
            report = { id: Number(mth1[1]), type: "badans" }; type = "answer";
        }
        else if (mth2)
        {
            report = { id: Number(mth2[1]), type: "badart" }; type = "article";
        }
        else if (mth3)
        {
            reportSpam(mth3[1], "member");
        }
    }
    else if (txt.startsWith("{"))
    {
        const dat = JSON.parse(txt);
        report = { id: Number(dat.id), type: dat.type === "answer" ? "badans" : "badart" };
        type = dat.type;
    }
    if (!report)
        return;
    ContentBase._report("spams", report);
    const result = await ContentBase.checkSpam(type, report.id);
    const uids = result.normal.filter(u => u != "");
    thisbtn.textContent = `${uids.length}/${result.total}`;
    let cnt = 0;
    let alldone = true;
    for (let i = 0; i < uids.length; ++i)
    {
        const uid = uids[i];
        const user = await ContentBase.checkUserState(uid, undefined, [1]);
        if (!user)
            continue;
        thisbtn.textContent = uid;
        if (user.status === "ban" || user.status === "sban")
        {
            thisbtn.style.backgroundColor = "black";
            const acts = (await ContentBase.fetchUserActs(uid, 36)).acts;
            ContentBase._report("batch", acts);
        }
        else
        {
            try
            {
                thisbtn.style.backgroundColor = "rgb(0,224,32)";
                await reportSpam(uid, "member");
                cnt++;
            }
            catch (e)
            {
                alldone = false;
                break;
            }
        }
    }
    thisbtn.style.backgroundColor = alldone ? "rgb(0,224,32)" : "rgb(224,0,32)";
    thisbtn.textContent = cnt + "个";
}

/**
 * @param {HTMLElement} element
 */
function setDraggable(element)
{
    element.draggable = true;
    element.ondragstart = (ev) =>
    {
        ev.dataTransfer.setData("text", JSON.stringify(ev.target.dataset));
    }
    if (element.classList.contains("Btn-ReportSpam"))
    {
        element.ondragover = ev => ev.preventDefault();
        element.ondrop = autoReportAll;
    }
}


async function addSpamVoterBtns(voterNodes)
{
    const users = [];
    const btnMap = [];
    for (let idx = 0; idx < voterNodes.length; ++idx)
    {
        const node = voterNodes[idx];
        const nameLink = $(".UserItem-name .UserLink-link", node).get(0);
        if (!nameLink)
            continue;
        const uid = nameLink.getAttribute("href").split("/").pop();
        users.push(uid);
        const moduleNode = node.children[0];
        const dset = JSON.parse(moduleNode.dataset.zaModuleInfo || moduleNode.dataset.zaExtraModule);
        const hashid = dset.card.content.member_hash_id;
        if (hashid[0] === "#" && hashid != "#-1")
        {
            const votedate = Number(hashid.substr(1));
            const [, , , hour, minu, ,] = new Date(votedate * 1000).getDetailCHN();
            const vdspan = document.createElement("span");
            vdspan.className = "ContentItem-statusItem";
            vdspan.textContent = `${hour}:${minu}`;
            $(".ContentItem-status", node).append(vdspan);
        }

        const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn.dataset.id = uid;
        btn.dataset.type = "member";
        $(".ContentItem-extra", node).prepend(btn);
        btnMap.push(btn);

        const btn2 = createButton(["Btn-CheckStatus", "Button--primary"], "检测");
        btn2.dataset.id = uid;
        setDraggable(btn2);
        $(".ContentItem-extra", node).prepend(btn2);
    }
    const result = await ContentBase.checkSpam("users", users);
    for (let idx = 0; idx < btnMap.length; ++idx)
    {
        const btn = btnMap[idx];
        const id = btn.dataset.id;
        if (result.banned.has(id))
            btn.style.backgroundColor = "black";
        else if (result.spamed.has(id))
            btn.style.backgroundColor = "cornsilk";
    }
};
const voterObserver = new MutationObserver(records =>
{
    if (document.body.querySelector("#ZHE_BLOCKING_VOTER"))
        document.body.removeChild(BLOCKING_FLAG);
    const voterNodes = Array.fromArray(
        records.filter(record => (record.type == "childList" && record.target.nodeName == "DIV"))
            .map(record => $.makeArray(record.addedNodes)))
        .filter(node => node.hasClass("List-item") && !node.hasChild(".Btn-ReportSpam"));
    addSpamVoterBtns(voterNodes);
});
function monitorVoter(voterPopup)
{
    voterObserver.disconnect();
    console.log("detected voter-popup", voterPopup);
    const curVoters = $(voterPopup).find(".List-item").toArray()
        .filter(node => !node.hasChild(".Btn-ReportSpam"));
    console.log("current " + curVoters.length + " voters", curVoters);
    addSpamVoterBtns(curVoters);
    voterObserver.observe($(voterPopup)[0], { "childList": true });
    const title = $(voterPopup).siblings(".Topbar").find(".Topbar-title")[0];
    if (title)
    {
        const btn1 = createButton(["Btn-CheckAllStatus", "Button--primary"], "检测全部");
        btn1.ondragover = ev => ev.preventDefault();
        btn1.ondrop = ev =>
        {
            ev.preventDefault();
            const thisbtn = ev.target;
            /**@type {{uid:string}}*/
            const ds = JSON.parse(ev.dataTransfer.getData("text"));
            const btns = $(".Btn-CheckStatus", voterPopup).toArray();
            for (let i = 0; i < btns.length; ++i)
            {
                if (btns[i].dataset.id == ds.id)
                    break;
                if (btns[i].style.backgroundColor == "")
                    btns[i].style.backgroundColor = "rgb(0, 224, 32)";
            }
        }
        const btn2 = createButton(["Btn-AssocAns", "Button--primary"], "启发");
        const btn3 = createButton(["Btn-Similarity", "Button--primary"], "相似性");
        const btn4 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");

        if (CUR_ANSWER)
            btn2.dataset.id = CUR_ANSWER, btn2.dataset.qname = "ansid", btn4.dataset.id = CUR_ANSWER, btn4.dataset.qname = "ansid";
        else if (CUR_ARTICLE)
            btn2.dataset.id = CUR_ARTICLE, btn2.dataset.qname = "artid", btn4.dataset.id = CUR_ARTICLE, btn4.dataset.qname = "artid";

        title.appendChild(btn1);
        title.appendChild(btn2);
        title.appendChild(btn3);
        title.appendChild(btn4);
    }
}

function addAASpamBtns(answerNodes)
{
    answerNodes.filter(node => !node.hasChild(".Btn-ReportSpam"))
        .forEach(node =>
        {
            if (!node) return;
            /**@type {{type: string, token: string, upvote_num: number, comment_num: number, parent_token: string, author_member_hash_id: string}}*/
            const ansInfo = JSON.parse(node.dataset.zaModuleInfo || node.dataset.zaExtraModule).card.content;
            let thetype;
            if (ansInfo.type === "Answer")
                thetype = "answer";
            else if (ansInfo.type === "Post")
                thetype = "article";
            else
                return;

            const ansid = ansInfo.token;
            const ansArea = node.querySelector(".AuthorInfo");
            if (!ansArea)
                return;
            {
                const btn = createButton(["Btn-CheckSpam", "Button--primary"], "分析");
                btn.dataset.id = ansid;
                btn.dataset.type = thetype;
                setDraggable(btn);
                ansArea.appendChild(btn);
            }
            {
                const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
                btn.dataset.id = ansid;
                btn.dataset.type = thetype;
                setDraggable(btn);
                ansArea.appendChild(btn);
            }
        });
}

function addQuickCheckBtns(feedbackNodes)
{
    feedbackNodes.filter(node => !node.hasChild(".Btn-QCheckStatus"))
        .forEach(node =>
        {
            const hrefNode = Array.from(node.children[1].querySelectorAll("a"))
                .filter(aNode => aNode.href.includes("/people/"))[0];
            if (!hrefNode)
                return;
            let uid = hrefNode.href.split("/").pop();
            const btnNode = node.children[2];
            const btn = createButton(["Btn-QCheckStatus"], "检测");
            btn.dataset.id = uid;
            btnNode.insertBefore(btn, btnNode.children[1]);
        });
}

const bodyObserver = new MutationObserver(records =>
{
    //console.log("detect add body comp", records);
    const addNodes = Array.fromArray(records
        .map(record => $.makeArray(record.addedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    const delNodes = Array.fromArray(records
        .map(record => $.makeArray(record.removedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    {
        const voterPopup = $(addNodes).find(".VoterList-content").toArray();
        if (voterPopup.length > 0)
            monitorVoter(voterPopup);
        if ($(delNodes).find(".VoterList-content").length > 0)
        {
            console.log("here removed", delNodes);
            CUR_ANSWER = null;
            CUR_ARTICLE = null;
        }
    }
    {
        const ansartNodes = $(addNodes).find(".AnswerItem, .ArticleItem").toArray();
        if (ansartNodes.length > 0)
            addAASpamBtns(ansartNodes);
    }
});
    

$("body").on("click", "button.Btn-ReportSpam", function ()
{
    const btn = $(this)[0];
    reportSpam(btn.dataset.id, btn.dataset.type)
        .done(() => btn.style.backgroundColor = "rgb(0,224,32)")
        .fail((e) =>
        {
            console.warn("report fail:" + e.code, e.error);
            if (e.code === 103001)//repeat
                btn.style.backgroundColor = "rgb(224,224,32)";
            else if (e.code === 4039)//need verify
                btn.style.backgroundColor = "rgb(32,64,192)";
            else
                btn.style.backgroundColor = "rgb(224,0,32)";
        });
});
$("body").on("click", "button.Btn-CheckSpam", async function (e)
{
    /**@type {HTMLButtonElement}*/
    const btn = e.target;
    const id = btn.dataset.id;
    const type = btn.dataset.type;
    let total, result;
    if (e.shiftKey)
    {
        if (e.ctrlKey)
        {
            document.body.appendChild(BLOCKING_FLAG);
            const showbtn = btn.parentNode.parentNode.querySelector(".Voters").querySelector("button");
            showbtn.click();
            return;
        }
        result = await ContentBase.checkSpam(type, Number(id));
        total = result.total;
    }
    else
    {
        const voters = await ContentBase.fetchTheVoters(type, id, LIM_FetchVoter, e.ctrlKey ? "old" : "new",
            (cur, all) => btn.innerText = "=>" + cur + "/" + all);
        {
            const rep = { users: voters };
            if (type === "answer")
                rep.zans = voters.map(user => new Zan(user, id));
            else if (type === "article")
                rep.zanarts = voters.map(user => new Zan(user, id));
            ContentBase._report("batch", rep);
        }
        btn.addClass("Button--blue");

        result = await ContentBase.checkSpam("users", voters.mapToProp("id"));
        total = voters.length;
    }
    const ban = result.banned.size, spm = result.spamed.size;
    btn.innerText = "(" + ban + "+" + spm + ")/" + total;
    btn.style.fontSize = "smaller";
    btn.style.fontWeight = "bold";

    if (total === 0)
        return;

    const ratio = (2 * (ban + spm) / total) - 1;
    const blue = 64 - Math.ceil(Math.abs(ratio) * 32);
    const red = ratio > 0 ? 224 : Math.ceil((ratio + 1) * 192) + 32;
    const green = ratio < 0 ? 224 : 224 - Math.ceil(ratio * 192);
    btn.style.backgroundColor = "rgb(" + red + "," + green + "," + blue + ")";
});

async function onChkStatus(e)
{
    const btn = e.target;
    const uid = btn.dataset.id;
    if (e.ctrlKey)
    {
        chrome.runtime.sendMessage({ action: "openpage", target: "https://www.zhihu.com/people/" + uid + "/activities", isBackground: true });
        return;
    }
    const user = await ContentBase.checkUserState(uid, undefined, [1]);
    if (!user)
        return;
    if (user.status === "ban" || user.status === "sban")
    {
        btn.style.backgroundColor = "black";
        $(btn).siblings(".Btn-ReportSpam")[0].style.backgroundColor = "black";
        const acts = (await ContentBase.fetchUserActs(uid, 36)).acts;
        ContentBase._report("batch", acts);
    }
    else
    {
        btn.style.backgroundColor = "rgb(0,224,32)";
        $(btn).siblings(".Btn-ReportSpam")[0].style.backgroundColor = "";
    }
}

$("body").on("click", "button.Btn-CheckStatus", onChkStatus);
$("body").on("click", "button.Btn-CheckAllStatus", async function (e)
{
    const btn = $(this)[0];
    const isCtrl = e.ctrlKey, isShift = e.shiftKey;
    const voterList = btn.parentNode.parentNode.parentNode;
    const btnList = [];
    $(voterList).find(".ContentItem").each((idx, item) =>
    {
        const extraArea = item.querySelector(".ContentItem-extra");
        if (!extraArea)
            return;
        const btnChk = extraArea.children[0], btnSpam = extraArea.children[1];
        if (btnChk.style.backgroundColor != "")//has result
            return;
        if (!isShift && btnSpam.style.backgroundColor == "black")
            return;
        if (!isCtrl && btnSpam.style.backgroundColor != "")
            return;
        btnList.push({ name: btnChk.dataset.id, btn: btnChk });
    });
    console.log("detect " + btnList.length + " user");
    for (let idx = 0; idx < btnList.length; ++idx)
    {
        btn.textContent = btnList[idx].name;
        const event = { target: btnList[idx].btn, ctrlKey: false };
        await Promise.all([onChkStatus(event), _sleep(800 + idx * 15)]);
    }
    btn.textContent = "检测全部";
});
$("body").on("click", "span.Voters", function ()
{
    const span = $(this)[0];
    const itemNode = $(span).parents("div.AnswerItem")[0] || $(span).parents("div.ArticleItem")[0];
    if (!itemNode)
        return;

    /**
     * @type {{type: "Post"|"Answer", token: string, upvote_num: number, comment_num: number, publish_timestamp: number, author_member_hash_id: string}}
     */
    const itemContent = JSON.parse(itemNode.dataset.zaModuleInfo || itemNode.dataset.zaExtraModule).card.content;
    if (itemContent.type === "Answer")
        CUR_ANSWER = itemContent.token;
    else if (itemContent.type === "Post")
        CUR_ARTICLE = itemContent.token;
});
$("body").on("click", "button.Btn-AssocAns", e =>
{
    const btn = e.target;
    let query = `${btn.dataset.qname}=${btn.dataset.id}`;
    if (!btn.dataset.qname)
        query = `vid=` + $(".Btn-CheckStatus").toArray().map(x => x.dataset.id).join("*");
    const target = e.ctrlKey ? "StatVoter.html?" : "AssocAns.html?";
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: target + query });
});
$("body").on("click", "button.Btn-StatVoter", e =>
{
    const btn = e.target;
    const query = `${btn.dataset.qname}=${btn.dataset.id}`;
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "StatVoter.html?" + query });
});
$("body").on("click", "button.Btn-ShowTime", e =>
{
    const btn = e.target;
    const query = e.ctrlKey && btn.dataset.qname === "uid" ? `athid=${btn.dataset.id}` : `${btn.dataset.qname}=${btn.dataset.id}`;
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "Timeline.html?" + query });
});
$("body").on("click", "button.Btn-Similarity", e =>
{
    const thisbtn = e.target;
    const msg = { action: "chksim", target: "", data: null };
    if (CUR_ANSWER)
        msg.target = "answer", msg.data = CUR_ANSWER;
    else if (CUR_ARTICLE)
        msg.target = "article", msg.data = CUR_ARTICLE;
    else
        return;
    const voterList = thisbtn.parentNode.parentNode.parentNode;
    /**@type {HTMLButtonElement[]}*/
    const btns = [];
    $(voterList).find(".ContentItem").each((idx, item) =>
    {
        const extraArea = item.querySelector(".ContentItem-extra");
        if (!extraArea)
            return;
        btns.push(extraArea.children[1]);
    });
    console.log("detect " + btns.length + " user");
    chrome.runtime.sendMessage(msg, /**@param {[string, [number, number, number]][]} result*/(result) =>
    {
        console.log(result);
        const simmap = new Map(result.data);
        let maxcnt = 0;
        btns.forEach(btn =>
        {
            const counts = simmap.get(btn.dataset.id);
            btn.textContent = `${counts[0]}(${counts[1]})/${counts[2]}`;
            btn.style.fontSize = "smaller";
            btn.style.fontWeight = "bold";
            maxcnt = Math.max(maxcnt, counts[0]);
        });
        thisbtn.textContent = `${maxcnt}(${result.limit})`;
        thisbtn.style.fontSize = "smaller";
        thisbtn.style.fontWeight = "bold";
    });
});
$("body").on("click", "button.Modal-closeButton", function ()
{
    CUR_ANSWER = null;
    CUR_ARTICLE = null;
});


{
    $(".Btn-ReportSpam").toArray().forEach(setDraggable);
    const curAnsArts = $(".AnswerItem, .ArticleItem").toArray();
    console.log("init " + curAnsArts.length + " answer/article");
    addAASpamBtns(curAnsArts);
}

async function TrashDropper(ev)
{
    const mapper = { answer: "badans", article: "badart", member: "badusr" };
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    let report;
    if (txt.includes("http"))
    {
        const mth1 = txt.match(/zhihu.com\/question\/\d*\/answer\/(\d*)/i);
        const mth2 = txt.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
        const mth3 = txt.match(/www.zhihu.com\/people\/([^\/]+)/i);
        if (mth1)
            report = { id: Number(mth1[1]), type: "badans" };
        else if (mth2)
            report = { id: Number(mth2[1]), type: "badart" };
        else if (mth3)
            report = { id: mth3[1], type: "badusr" };
    }
    else if (txt.startsWith("{") && txt.endsWith("}"))
    {
        const dat = JSON.parse(txt);
        report = { id: Number(dat.id), type: mapper[dat.type] };
    }
    else if (txt.startsWith("#comment"))
    {
        const aid = Number(txt.substr(8));
        const cms = await ContentBase.fetchComments(aid, 1000);
        const users = cms.map(cm => User.fromRawJson(cm.author.member));
        console.log(users);
        ContentBase._report("users", users);
        report = users.map(usr => ({ id: usr.id, type: "badusr" })).filter(x => x.id);
    }
    if (report)
    {
        if (!ev.ctrlKey)
        {
            ContentBase._report("spams", report);
            return;
        }
    }
}
{
    const fbtns = document.body.querySelector(".CornerButtons");
    const svgZH = createSVG(24, 24, "0 0 100 91",
        "M53.29 80.035l7.32.002 2.41 8.24 13.128-8.24h15.477v-67.98H53.29v67.978zm7.79-60.598h22.756v53.22h-8.73l-8.718 5.473-1.587-5.46-3.72-.012v-53.22zM46.818 43.162h-16.35c.545-8.467.687-16.12.687-22.955h15.987s.615-7.05-2.68-6.97H16.807c1.09-4.1 2.46-8.332 4.1-12.708 0 0-7.523 0-10.085 6.74-1.06 2.78-4.128 13.48-9.592 24.41 1.84-.2 7.927-.37 11.512-6.94.66-1.84.785-2.08 1.605-4.54h9.02c0 3.28-.374 20.9-.526 22.95H6.51c-3.67 0-4.863 7.38-4.863 7.38H22.14C20.765 66.11 13.385 79.24 0 89.62c6.403 1.828 12.784-.29 15.937-3.094 0 0 7.182-6.53 11.12-21.64L43.92 85.18s2.473-8.402-.388-12.496c-2.37-2.788-8.768-10.33-11.496-13.064l-4.57 3.627c1.363-4.368 2.183-8.61 2.46-12.71H49.19s-.027-7.38-2.372-7.38",
        { fill: "#ff7000" });
    const btn1 = createButton(["CornerButton", "Button--plain"]);
    btn1.dataset.tooltip = "知乎疯牛病";
    btn1.dataset.tooltipPosition = "left";
    btn1.appendChild(svgZH);
    const btndiv1 = document.createElement("div");
    btndiv1.id = "MarkBtn";
    btndiv1.addClass("CornerAnimayedFlex");
    btndiv1.appendChild(btn1);
    btndiv1.draggable = true;
    btndiv1.ondragstart = (ev) =>
    {
        ev.dataTransfer.setData("text", "MarkBtn");
    }

    const svgTrash = createSVG(28, 28, "0 0 512 512",
        "M341,128V99c0-19.1-14.5-35-34.5-35H205.4C185.5,64,171,79.9,171,99v29H80v32h9.2c0,0,5.4,0.6,8.2,3.4c2.8,2.8,3.9,9,3.9,9  l19,241.7c1.5,29.4,1.5,33.9,36,33.9h199.4c34.5,0,34.5-4.4,36-33.8l19-241.6c0,0,1.1-6.3,3.9-9.1c2.8-2.8,8.2-3.4,8.2-3.4h9.2v-32  h-91V128z M192,99c0-9.6,7.8-15,17.7-15h91.7c9.9,0,18.6,5.5,18.6,15v29H192V99z M183.5,384l-10.3-192h20.3L204,384H183.5z   M267.1,384h-22V192h22V384z M328.7,384h-20.4l10.5-192h20.3L328.7,384z",
        { fill: "#000" });
    const btn2 = createButton(["CornerButton", "Button--plain"]);
    btn2.dataset.tooltip = "记录广告";
    btn2.dataset.tooltipPosition = "left";
    btn2.appendChild(svgTrash);
    const btndiv2 = document.createElement("div");
    btndiv2.id = "TrashBtn";
    btndiv2.addClass("CornerAnimayedFlex");
    btndiv2.appendChild(btn2);
    btndiv2.ondragover = ev => ev.preventDefault();
    btndiv2.ondrop = TrashDropper;

    if (fbtns)
    {
        fbtns.prepend(btndiv1);
        fbtns.prepend(btndiv2);
    }
}

bodyObserver.observe(document.body, { "childList": true, "subtree": true });
