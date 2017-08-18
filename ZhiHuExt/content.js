"use strict"

function formColor(red, green, blue)
{
    const sred = red.toString(16), sgreen = green.toString(16), sblue = blue.toString(16);
    if (sred.length < 2) sred = "0" + sred;
    if (sgreen.length < 2) sgreen = "0" + sgreen;
    if (sblue.length < 2) sblue = "0" + sblue;
    return "#" + sred + sgreen + sblue;
}



function checkUserState(uid)
{
    const pms = $.Deferred();
    _get("https://www.zhihu.com/people/" + uid + "/activities")
        .done((data) =>
        {
            const html = document.createElement("html");
            html.innerHTML = data;
            const dataElement = html.querySelector("#data");
            if (!dataElement)
            {
                pms.resolve(null);
                return;
            }
            const state = JSON.parse(dataElement.dataset.state);
            const theuser = state.entities.users[uid];
            if (!theuser)
            {
                pms.resolve(null);
                return;
            }
            const user = User.fromRawJson(theuser);
            pms.resolve(user);
            console.log(theuser);
        })
        .fail((e) => { console.warn(e); pms.resolve(null); });
    return pms;
}

function checkSpam(target, data)
{
    const pms = $.Deferred();
    if (!data || (data instanceof Array && data.length === 0))
        pms.resolve({ banned: [], spamed: [] });
    else
        chrome.runtime.sendMessage({ action: "chkspam", target: target, data: data },
            ret => pms.resolve(ret));
    return pms;
}
function getAnsVoters(ansId, offset, limit, pms)
{
    if (!pms)
    {
        pms = $.Deferred();
        pms.extraData = [];
        pms.voterEnd = false;
    }
    _get("https://www.zhihu.com/api/v4/answers/" + ansId + "/voters?include=data[*].answer_count&limit=20&offset=" + offset)
        .done((data, status, xhr) =>
        {
            pms.voterEnd = data.paging.is_end;
            data.data.forEach(item =>
            {
                const user = new User();
                user.id = item.url_token;
                user.name = item.name;
                user.anscnt = item.answer_count;
                user.head = item.avatar_url.split("/").pop().removeSuffix(7);
                pms.extraData.push(user);
            });
        })
        .fail((data, status, xhr) =>
        {
            if (data.responseJSON)
                console.warn("getAnsVoter fail:" + xhr.status, data.responseJSON.error.message);
            else
                console.warn("getAnsVoter fail:" + xhr.status);
        })
        .always(() =>
        {
            if (!pms.voterEnd && offset < limit)
                getAnsVoters(ansId, offset + 20, limit, pms);
            else//finish
                pms.resolve(pms.extraData);
        });
    return pms;
}
function reportSpam(id, type)
{
    const payload = { "resource_id": id, "type": type, "reason_type": "spam", "source": "web" };
    _report("spam", { id: id, type: type });
    //req.setRequestHeader("Referer", "https://www.zhihu.com/people/" + id + "/activities");
    const pms = $.Deferred();
    _post("https://www.zhihu.com/api/v4/reports", payload)
        .done((data, status, xhr) =>
        {
            if (xhr.status === 204 || xhr.status === 200)
                pms.resolve();
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

function createButton(extraClass, text)
{
    const btn = document.createElement('button');
    btn.addClass("Button");
    btn.addClasses(...extraClass);
    btn.setAttribute("type", "button");
    btn.innerText = text;
    return btn;
}


let CUR_QUESTION = null;
let CUR_ANSWER = null;

function parseUser(node)
{
    const nameLink = $(".UserItem-name .UserLink-link", node).get(0);
    if (!nameLink)
        return null;
    const user = new User();
    user.id = nameLink.getAttribute("href").split("/").pop();
    user.name = nameLink.innerText;
    user.head = node.querySelector("img.UserLink-avatar").src
        .split("/").pop()
        .removeSuffix(7);
    const info = node.querySelectorAll("span.ContentItem-statusItem")
        .forEach(span =>
        {
            const txt = span.innerText;
            const num = parseInt(txt);
            if (txt.includes("回答"))
                user.anscnt = num;
            else if (txt.includes("文章"))
                user.articlecnt = num;
            else if (txt.includes("关注"))
                user.followcnt = num;
        });
    return user;
}

//node is div of class"AnswerItem"
function parseAnswer(node)
{
    if (!node)
        return null;
    const ansInfo = JSON.parse(node.dataset.zaModuleInfo).card.content;
    if (ansInfo.type != "Answer")
        return null;
    const answer = new Answer();
    answer.id = ansInfo.token;
    answer.question = ansInfo.parent_token;
    answer.zancnt = ansInfo.upvote_num;

    const nameLink = node.querySelector("a.UserLink-link");
    if (nameLink)
        answer.author = nameLink.getAttribute("href").split("/").pop();

    return answer;
}


async function addSpamVoterBtns(voterNodes)
{
    const users = [];
    const btnMap = [];
    for (let idx = 0; idx < voterNodes.length; ++idx)
    {
        const node = voterNodes[idx];
        const user = parseUser(node);
        if (!user)
            continue;
        users.push(user);

        const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn.dataset.id = user.id;
        btn.dataset.type = "member";
        $(".ContentItem-extra", node).prepend(btn);
        btnMap.push(btn);

        const btn2 = createButton(["Btn-CheckStatus", "Button--primary"], "检测");
        btn2.dataset.id = user.id;
        $(".ContentItem-extra", node).prepend(btn2);
    }
    _report("users", users);
    if (CUR_ANSWER)
    {
        const zans = users.map(user => new Zan(user, CUR_ANSWER));
        _report("zans", zans);
    }

    const result = await checkSpam("users", users);
    const banned = result.banned.mapToProp("id");
    const spamed = result.spamed.mapToProp("id");
    for (let idx = 0; idx < btnMap.length; ++idx)
    {
        const btn = btnMap[idx];
        const id = btn.dataset.id;
        if (banned.includes(id))
            btn.style.backgroundColor = "black";
        else if (spamed.includes(id))
            btn.style.backgroundColor = "cornsilk";
    }
};
const voterObserver = new MutationObserver(records =>
{
    //console.log("detect add voters", records);
    const voterNodes = Array.fromArray(
        records.filter(record => (record.type == "childList" && record.target.nodeName == "DIV"))
            .map(record => $.makeArray(record.addedNodes)))
        .filter(node => node.hasClass("List-item") && !node.hasChild(".Btn-ReportSpam"));
    console.log("added " + voterNodes.length + " voters", voterNodes);
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
        const btn = createButton(["Btn-CheckAllStatus", "Button--primary"], "检测全部");
        title.appendChild(btn);
    }
}

function addSpamAnsBtns(answerNodes)
{
    const answers = [];
    const zans = [];
    answerNodes.filter(node => !node.hasChild(".Btn-ReportSpam"))
        .forEach(node =>
        {
            const answer = parseAnswer(node);
            if (!answer) return;
            answers.push(answer);
            if (ContentBase.CUR_USER)
            {
                const span = $("span.ActivityItem-metaTitle", node.parentElement)[0];
                if (span && span.innerText.startsWith("赞"))
                    zans.push(new Zan(ContentBase.CUR_USER, answer));
            }
            const ansArea = node.querySelector(".AuthorInfo");
            if (!ansArea)
                return;
            {
                const btn = createButton(["Btn-CheckSpam", "Button--primary"], "分析");
                btn.dataset.id = answer.id;
                ansArea.appendChild(btn);
            }
            {
                const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
                btn.dataset.id = answer.id;
                btn.dataset.type = "answer";
                ansArea.appendChild(btn);
            }
        });
    _report("answers", answers);
    _report("zans", zans);
    return answers;
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
        }
    }
    {
        const answerNodes = $(addNodes).find(".AnswerItem").toArray();
        if (answerNodes.length > 0)
            addSpamAnsBtns(answerNodes);
    }
});
    

$("body").on("click", ".Btn-ReportSpam", function ()
{
    const btn = $(this)[0];
    reportSpam(btn.dataset.id, btn.dataset.type)
        .done(() => btn.style.backgroundColor = "rgb(0,224,32)")
        .fail((e) =>
        {
            console.warn("report fail:" + e.code, e.error);
            if (e.code === 103001)
                btn.style.backgroundColor = "rgb(224,224,32)";
            else
                btn.style.backgroundColor = "rgb(224,0,32)";
        });
});
$("body").on("click", ".Btn-CheckSpam", async function ()
{
    const btn = $(this)[0];
    const ansId = btn.dataset.id;
    const voters = await getAnsVoters(ansId, 0, 1300);

    btn.addClass("Button--blue");
    _report("users", voters);
    const zans = voters.map(user => new Zan(user, ansId));
    _report("zans", zans);

    const result = await checkSpam("users", voters);
    const total = voters.length, ban = result.banned.length, spm = result.spamed.length;
    btn.innerText = "(" + ban + "+" + spm + ")/" + total;
    if (total === 0)
        return;

    const ratio = (2 * (ban + spm) / total) - 1;
    const blue = 64 - Math.ceil(Math.abs(ratio) * 32);
    const red = ratio > 0 ? 224 : Math.ceil((ratio + 1) * 192) + 32;
    const green = ratio < 0 ? 224 : 224 - Math.ceil(ratio * 192);
    btn.style.backgroundColor = "rgb(" + red + "," + green + "," + blue + ")";
});
$("body").on("click", ".Btn-CheckStatus", async function (e)
{
    const btn = $(this)[0];
    const uid = btn.dataset.id;
    if (e.ctrlKey)
    {
        chrome.runtime.sendMessage({ action: "openpage", target: "https://www.zhihu.com/people/" + uid + "/activities", isBackground: true });
        return;
    }
    const user = await checkUserState(uid);
    if (!user)
        return;
    if (user.status === "ban")
    {
        btn.style.backgroundColor = "black";
        $(btn).siblings(".Btn-ReportSpam")[0].style.backgroundColor = "black";
    }
    else
    {
        btn.style.backgroundColor = "rgb(0,224,32)";
        $(btn).siblings(".Btn-ReportSpam")[0].style.backgroundColor = "";
    }
    _report("users", user);
});
$("body").on("click", ".Btn-CheckAllStatus", async function (e)
{
    const btn = $(this)[0];
    const isCtrl = e.ctrlKey;
    const voterList = btn.parentNode.parentNode.parentNode;
    const btnList = [];
    $(voterList).find(".ContentItem").each((idx, item) =>
    {
        const extraArea = item.querySelector(".ContentItem-extra");
        if (!extraArea)
            return;
        const btnChk = extraArea.children[0], btnSpam = extraArea.children[1];
        if (btnChk.style.backgroundColor != "" || btnSpam.style.backgroundColor == "black")//has result
            return;
        if (!isCtrl && btnSpam.style.backgroundColor != "")
            return;
        btnList.push({ name: btnChk.dataset.id, btn: btnChk });
    });
    console.log("detech " + btnList.length + "user");
    for (let idx = 0; idx < btnList.length; ++idx)
    {
        btn.textContent = btnList[idx].name;
        btnList[idx].btn.click();
        await _sleep(500);
    }
    btn.textContent = "检测全部";
});
$("body").on("click", "span.Voters", function ()
{
    const span = $(this)[0];
    const ansNode = $(span).parents("div.AnswerItem")[0];
    if (!ansNode)
        return;

    CUR_ANSWER = JSON.parse(ansNode.dataset.zaModuleInfo).card.content.token;
});
$("body").on("click", "button.Modal-closeButton", function ()
{
    CUR_ANSWER = null;
});


function procInQuestion()
{
    console.log("question page");
    const qstPage = $(".QuestionPage")[0];
    const qstData = JSON.parse(Array.from(qstPage.childNodes)
        .filter(node => node instanceof HTMLDivElement)
        .find(div => div.className == "")
        .dataset.zopQuestion);
    const topics = qstData.topics;
    const quest = new Question(qstData.id, qstData.title, topics.map(tp => tp.id));
    CUR_QUESTION = quest;
    _report("questions", quest);
    _report("topics", topics);
    const qstArea = $(".QuestionHeader-footer .QuestionButtonGroup")
    if (qstArea.length > 0)
    {
        const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn.dataset.id = CUR_QUESTION.id;
        btn.dataset.type = "question";
        qstArea.prepend(btn);
    }
}
function procInPeople()
{
    console.log("people page");
    const user = ContentBase.CUR_USER;
    const header = $("#ProfileHeader")[0];
    if (!user || !header)
        return;

    const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
    btn.dataset.id = user.id;
    btn.dataset.type = "member";
    setTimeout(() => $(".ProfileButtonGroup", header).prepend(btn), 500);
}

const cmrepotObserver = new MutationObserver(records =>
{
    //console.log("detect add community report", records);
    let rows = [];
    for (let ridx = 0; ridx < records.length; ++ridx)
    {
        const record = records[ridx];
        if (record.type != "childList")
            continue;
        const nodes = record.addedNodes;
        for (let nidx = 0; nidx < nodes.length; ++nidx)
        {
            const node = nodes[nidx];
            if (node instanceof HTMLTableRowElement)
                rows.push(node);
            else
                rows = rows.concat(Array.from(node.querySelectorAll("tr")));
        }
    }
    if (rows.length === 0)
        return;
    console.log("find " + rows.length + " table-row", rows);
    const spams = [];
    const userUpds = [];
    for (let ridx = 0; ridx < rows.length; ++ridx)
    {
        const tds = Array.from(rows[ridx].childNodes)
            .filter(child => child instanceof HTMLTableCellElement);
        if (tds.length !== 5)
            continue;
        if (tds[2].innerText == "用户")
        {
            const link = tds[3].querySelector("a").href;
            const uid = link.split("/").pop();
            spams.push({ id: uid, type: "member" });
            if (tds[4].innerText.includes("已封禁"))
                userUpds.push(uid);
        }
    }
    _report("spam", spams);
    _update("users", "id", userUpds, { status: "ban" });
});

const pathname = document.location.pathname;
if (pathname.startsWith("/question/"))
{
    procInQuestion();
}
else if (pathname.startsWith("/people/"))
{
    procInPeople();
}
else if (pathname.startsWith("/community") && !pathname.includes("reported"))
{
    console.log("community report page");
    cmrepotObserver.observe($(".zu-main-content-inner")[0], { "childList": true, "subtree": true });
}
{
    const curAnswers = $(".AnswerItem").toArray();
    console.log("init " + curAnswers.length + " answers");
    addSpamAnsBtns(curAnswers);
}


bodyObserver.observe(document.body, { "childList": true, "subtree": true });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse)
{
    switch (request.action)
    {
        case "click":
            $(request.objname).click();
            break;
    }
}); 
