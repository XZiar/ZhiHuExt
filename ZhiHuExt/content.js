Array.prototype.addall = function (other)
{
    if ($.isArray(other))
        other.forEach(x => this.push(v));
    else
        console.warn("cannot add non-array to array", other);
}
Array.prototype.flatArray = function ()
{
    return Array.fromArrays(...this);
}
Array.fromArrays = function (...array)
{
    return [].concat.apply([], array);
}
Array.fromArray = function (array)
{
    if (array instanceof Array)
        return Array.fromArrays(...array);
    else
        return [array];
}
String.prototype.removeSuffix = function (count)
{
    var del = Math.min(this.length, count);
    return this.substring(0, this.length - del);
}

$.prototype.forEach = function (consumer)
{
    this.each((idx, ele) =>
    {
        try
        {
            consumer(ele);
        }
        catch (e) { console.warn(e); }
    });
}

HTMLElement.prototype.hasClass = function (className)
{
    if (this.classList)
        return this.classList.contains(className);
    else
        return new RegExp('(^| )' + className + '( |$)', 'gi').test(this.className);
}
HTMLDivElement.prototype.hasChild = function (selector)
{
    if (this.querySelector(selector))
        return true;
    else
        return false;
}
/*Node.prototype.findChild = function (selector, ...more)
{
    var children = this.querySelectorAll("selector");
    if (more.length === 0)
        return children;

    return Array.fromArray(Array.from(children)
            .map(child => child.findChild(...more))
        .filter(ret => ret.length > 0));
}*/


function formColor(red, green, blue)
{
    var sred = red.toString(16), sgreen = green.toString(16), sblue = blue.toString(16);
    if (sred.length < 2) sred = "0" + sred;
    if (sgreen.length < 2) sgreen = "0" + sgreen;
    if (sblue.length < 2) sblue = "0" + sblue;
    return "#" + sred + sgreen + sblue;
}
function _get(url, data)
{
    return $.ajax(url,
        {
            type: "GET",
            dataType: "json",
            data: data
        });
}
function _post(url, data)
{
    var cType;
    if (typeof data == "string")
        cType = "application/x-www-form-urlencoded";
    else
    {
        cType = "application/json";
        data = JSON.stringify(data);
    }
    return $.ajax(url,
        {
            type: "POST",
            contentType: cType,
            dataType: "json",
            data: data
        });
}
function _report(target, data)
{
    if (!data || (data instanceof Array && data.length === 0))
        return;
    chrome.runtime.sendMessage({ action: "insert", target: target, data: data });
}


function checkSpam(target, data)
{
    var pms = $.Deferred();
    if (!data || (data instanceof Array && data.length === 0))
        pms.resolve([]);
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
                var user = new User();
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
    var payload = { "resource_id": id, "type": type, "reason_type": "spam", "source": "web" };
    _report("spam", { id: id, type: type });
    //req.setRequestHeader("Referer", "https://www.zhihu.com/people/" + id + "/activities");
    var pms = $.Deferred();
    _post("https://www.zhihu.com/api/v4/reports", payload)
        .done((data, status, xhr) =>
        {
            if (xhr.status === 204 || xhr.status === 200)
                pms.resolve();
        })
        .fail((data, status, xhr) =>
        {
            if (data.responseJSON)
                pms.reject({ code: xhr.status, error: data.responseJSON.error.message });
            else
                pms.reject({ code: xhr.status, error: "unknown error" });
        })
    return pms;
}

function createButton(extraClass, text)
{
    var btn = document.createElement('button');
    btn.className = "Button " + extraClass;
    btn.setAttribute("type", "button");
    btn.innerText = text;
    return btn;
}


var CUR_QUESTION = null;
var CUR_ANSWER = null;
var CUR_USER = null;


function parseUser(node)
{
    var nameLink = $(".UserItem-name .UserLink-link", node).get(0);
    //var nameLink = node.findChild(".UserItem-name", ".UserLink-link").pop();
    if (!nameLink)
        return null;
    var user = new User();
    user.id = nameLink.getAttribute("href").split("/").pop();
    user.name = nameLink.innerText;
    user.head = node.querySelector("img.UserLink-avatar").src
        .split("/").pop()
        .removeSuffix(7);
    var info = node.querySelectorAll("span.ContentItem-statusItem")
        .forEach(span =>
        {
            var txt = span.innerText;
            var num = parseInt(txt);
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
    var ansInfo = JSON.parse(node.dataset.zaModuleInfo).card.content;
    if (ansInfo.type != "Answer")
        return null;
    var answer = new Answer();
    answer.id = ansInfo.token;
    answer.question = ansInfo.parent_token;
    answer.zancnt = ansInfo.upvote_num;

    var nameLink = node.querySelector("a.UserLink-link");
    if (nameLink)
        answer.author = nameLink.getAttribute("href").split("/").pop();

    return answer;
}


function addSpamUserBtns(voterNodes)
{
    var users = [];
    voterNodes.forEach(node =>
    {
        var user = parseUser(node);
        if (!user) return;
        users.push(user);

        var btn = createButton("Btn-ReportSpam Button--primary", "广告");
        btn.dataset.id = user.id;
        btn.dataset.type = "member";
        $(".ContentItem-extra", node).prepend(btn);
    });
    _report("users", users);
    return users;
};
var voterObserver = new MutationObserver(records =>
{
    //console.log("detect add voters", records);
    var voterNodes = Array.fromArray(
        records.filter(record => (record.type == "childList" && record.target.nodeName == "DIV"))
            .map(record => $.makeArray(record.addedNodes)))
        .filter(node => node.hasClass("List-item") && !node.hasChild(".Btn-ReportSpam"));
    console.log("added " + voterNodes.length + " voters", voterNodes);
    var users = addSpamUserBtns(voterNodes);
    if (CUR_ANSWER)
    {
        var zans = users.map(user => new Zan(user, CUR_ANSWER));
        _report("zans", zans);
    }
});
function monitorVoter(voterPopup)
{
    voterObserver.disconnect();
    console.log("detected voter-popup", voterPopup);
    var curVoters = $(voterPopup).find(".List-item").toArray()
        .filter(node => !node.hasChild(".Btn-ReportSpam"));
    console.log("current " + curVoters.length + " voters", curVoters);
    var users = addSpamUserBtns(curVoters);
    if (CUR_ANSWER)
    {
        var zans = users.map(user => new Zan(user, CUR_ANSWER));
        _report("zans", zans);
    }
    voterObserver.observe($(voterPopup)[0], { "childList": true });
}

function addSpamAnsBtns(answerNodes)
{
    var answers = [];
    var zans = [];
    answerNodes.filter(node => !node.hasChild(".Btn-ReportSpam"))
        .forEach(node =>
        {
            var answer = parseAnswer(node);
            if (!answer) return;
            answers.push(answer);
            if (CUR_USER)
            {
                var span = $("span.ActivityItem-metaTitle", node.parentElement)[0];
                if (span && span.innerText.startsWith("赞"))
                    zans.push(new Zan(CUR_USER, answer));
            }
            var ansArea = node.querySelector(".AuthorInfo");
            if (!ansArea)
                return;
            {
                var btn = createButton("Btn-CheckSpam Button--primary Button--blue", "分析");
                btn.dataset.id = answer.id;
                ansArea.appendChild(btn);
            }
            {
                var btn = createButton("Btn-ReportSpam Button--primary", "广告");
                btn.dataset.id = answer.id;
                btn.dataset.type = "answer";
                ansArea.appendChild(btn);
            }
        });
    _report("answers", answers);
    _report("zans", zans);
    return answers;
}

var bodyObserver = new MutationObserver(records =>
{
    //console.log("detect add body comp", records);
    var addNodes = Array.fromArray(records
        .map(record => $.makeArray(record.addedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    var delNodes = Array.fromArray(records
        .map(record => $.makeArray(record.removedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    {
        var voterPopup = $(addNodes).find(".VoterList-content").toArray();
        if (voterPopup.length > 0)
            monitorVoter(voterPopup);
        if ($(delNodes).find(".VoterList-content").length > 0)
        {
            console.log("here removed", delNodes);
            CUR_ANSWER = null;
        }
    }
    {
        var answerNodes = $(addNodes).find(".AnswerItem").toArray();
        if (answerNodes.length > 0)
            addSpamAnsBtns(answerNodes);
    }
});
    

$("body").on("click", ".Btn-ReportSpam", function ()
{
    var btn = $(this)[0];
    reportSpam(btn.dataset.id, btn.dataset.type)
        .done(() => btn.style.backgroundColor = "green")
        .fail((e) =>
        {
            console.warn("report fail:" + e.code, e.error);
            btn.style.backgroundColor = "red";
        });
});
$("body").on("click", ".Btn-CheckSpam", function ()
{
    var btn = $(this)[0];
    var ansId = btn.dataset.id;
    getAnsVoters(ansId, 0, 100)
        .done(voters =>
        {
            _report("users", voters);
            var zans = voters.map(user => new Zan(user, ansId));
            _report("zans", zans);
            checkSpam("users", voters)
                .done(spamed =>
                {
                    var total = voters.length, spm = spamed.length;
                    btn.innerText = spm + "/" + total;
                    var ratio = Math.ceil((spm / total) * 255);
                    var color = formColor(ratio, 255 - ratio, 64);
                    btn.style.backgroundColor = color;
                });
        });
});
$("body").on("click", "span.Voters", function ()
{
    var span = $(this)[0];
    var ansNode = $(span).parents("div.AnswerItem")[0];
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
    try
    {
        var qstPage = $(".QuestionPage")[0];
        var qstData = JSON.parse(Array.from(qstPage.childNodes)
            .filter(node => node instanceof HTMLDivElement)
            .find(div => div.className == "")
            .dataset.zopQuestion);
        var topics = qstData.topics;
        var quest = new Question(qstData.id, qstData.title, topics.map(tp => tp.id));
        CUR_QUESTION = quest;
        _report("questions", quest);
        _report("topics", topics);
        var qstArea = $(".QuestionHeader-footer .QuestionButtonGroup")
        if (qstArea.length > 0)
        {
            var btn = createButton("Btn-ReportSpam Button--primary", "广告");
            btn.dataset.id = CUR_QUESTION.id;
            btn.dataset.type = "question";
            qstArea.prepend(btn);
        }
    } catch (e) { console.warn(e); }
}
function procInPeople()
{
    var user = new User();
    var header = $("#ProfileHeader")[0];
    if (!header)
        return;
    user.id = JSON.parse(header.dataset.zaModuleInfo).card.content.token;
    user.name = $("span.ProfileHeader-name", header).text();
    user.head = header.querySelector("img.Avatar").src
        .split("/").pop()
        .removeSuffix(7);
    var info = $("#ProfileMain a.Tabs-link").toArray()
        .forEach(ahref =>
        {
            var txt = ahref.innerText;
            var num = parseInt(txt.substring(2));
            if (txt.includes("回答"))
                user.anscnt = num;
            else if (txt.includes("文章"))
                user.articlecnt = num;
        });
    user.followcnt = parseInt($(".FollowshipCard-counts a")[1].querySelector(".NumberBoard-value").innerText);
    CUR_USER = user;
    {
        var btn = createButton("Btn-ReportSpam Button--primary", "广告");
        btn.dataset.id = user.id;
        btn.dataset.type = "member";
        $(".ProfileButtonGroup", header).prepend(btn);
    }
    _report("users", user);
}

var cmrepotObserver = new MutationObserver(records =>
{
    //console.log("detect add community report", records);
    var rows = [];
    for (var ridx = 0, rlen = records.length; ridx < rlen; ++ridx)
    {
        var record = records[ridx];
        if (record.type != "childList")
            continue;
        for (var nidx = 0, nlen = record.addedNodes.length; nidx < nlen; ++nidx)
        {
            var node = record.addedNodes[nidx];
            if (node instanceof HTMLTableRowElement)
                rows.push(node);
            else
                rows = rows.concat(Array.from(node.querySelectorAll("tr")));
        }
    }
    if (rows.length === 0)
        return;
    console.log("find " + rows.length + " table-row", rows);
    var spams = [];
    for (var ridx = 0, rlen = rows.length; ridx < rlen; ++ridx)
    {
        var tds = Array.from(rows[ridx].childNodes)
            .filter(child => child instanceof HTMLTableCellElement);
        if (tds.length !== 5)
            continue;
        if (tds[2].innerText == "用户")
        {
            var link = tds[3].querySelector("a").href;
            spams.push({ id: link.split("/").pop(), type: "member" });
        }
    }
    _report("spam", spams);
});

var pathname = document.location.pathname;
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
    cmrepotObserver.observe($(".zu-main-content-inner")[0], { "childList": true, "subtree": true });
}
{
    var curAnswers = $(".AnswerItem").toArray();
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
