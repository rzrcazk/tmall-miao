const VERSION = '20240618-K'

if (!auto.service) {
    toast('无障碍服务未启动！退出！')
    exit()
}

let showVersion = function () {
    console.log('当前版本：' + VERSION)
    console.log('https://github.com/monsternone/tmall-miao')
    toast('当前版本：' + VERSION)
}

console.show()
showVersion()

function getSetting() {
    let indices = []
    autoOpen && indices.push(0)
    autoMute && indices.push(1)
    autoJoin && indices.push(2)
    indices.push(3)

    let settings = dialogs.multiChoice('任务设置', ['自动打开京东进入活动。多开或任务列表无法自动打开时取消勾选', '自动调整媒体音量为0。以免直播任务发出声音，首次选择需要修改系统设置权限', '自动完成入会任务。京东将授权手机号给商家，日后可能会收到推广短信', '此选项用于保证选择的处理，勿动！'], indices)

    if (settings.length == 0) {
        toast('取消选择，任务停止')
        exit()
    }

    if (settings.indexOf(0) != -1) {
        storage.put('autoOpen', true)
        autoOpen = true
    } else {
        storage.put('autoOpen', false)
        autoOpen = false
    }
    if (settings.indexOf(1) != -1) {
        storage.put('autoMute', true)
        autoMute = true
    } else {
        storage.put('autoMute', false)
        autoMute = false
    }
    if (settings.indexOf(2) != -1) {
        storage.put('autoJoin', true)
        autoJoin = true
    } else {
        storage.put('autoJoin', false)
        autoJoin = false
    }
}

let storage = storages.create("jd_task");
let autoOpen = storage.get('autoOpen', true)
let autoMute = storage.get('autoMute', true)
let autoJoin = storage.get('autoJoin', true)
getSetting()

if (autoMute) {
    try {
        device.setMusicVolume(0)
        toast('成功设置媒体音量为0')
    } catch (err) {
        alert('首先需要开启修复音量权限，请开启后再次运行脚本')
        exit()
    }
}

console.log('开始完成京东任务...')
console.log('按音量下键停止')

device.keepScreenDim(30 * 60 * 1000) // 防止息屏30分钟

// 自定义取消亮屏的退出方法
function quit() {
    device.cancelKeepingAwake()
    exit()
}

// 监听音量下键
function registerKey() {
    try {
        events.observeKey()
    } catch (err) {
        console.log('监听音量键停止失败，应该是无障碍权限出错，请关闭软件后台任务重新运行。')
        console.log('如果还是不行可以重启手机尝试。')
        quit()
    }
    events.onKeyDown('volume_down', function (event) {
        console.log('京东任务脚本停止了')
        console.log('请手动切换回主页面')
        startCoin && console.log('本次任务开始时有' + startCoin + '刮刮卡')
        quit()
    })
}
threads.start(registerKey)

// 自定义一个findTextDescMatchesTimeout
function findTextDescMatchesTimeout(reg, timeout) {
    let c = 0
    while (c < timeout / 500) {
        let result = textMatches(reg).findOnce() || descMatches(reg).findOnce()
        if (result) return result
        sleep(500)
        c++
    }
    return null
}

// 打开京东进入活动
function openAndInto() {
    console.log('正在打开京东App...')
    if (!launch('com.jingdong.app.mall')) {
        console.log('可能未安装京东App')
    } else {
        console.log('等待京东打开')
        for (let i = 0; i < 20; i++) {
            if (currentPackage() == 'com.jingdong.app.mall') break
            sleep(400)
        }
        if (currentPackage() != 'com.jingdong.app.mall') {
            console.log('程序检测京东app打开失败，请注意')
        }
    }

    sleep(2000)
    console.log('进入活动页面')

    app.startActivity({
        action: "VIEW",
        data: 'openApp.jdMobile://virtual?params={"category":"jump","action":"to","des":"m","sourceValue":"JSHOP_SOURCE_VALUE","sourceType":"JSHOP_SOURCE_TYPE","url":"https://pro.m.jd.com/mall/active/3uT8xr7BvwiWmif5m2h9j1zeKgBG/index.html?babelChannel=ttt5&hybrid_err_view=1&commontitle=no&disablePageSticky=1","M_sourceFrom":"mxz","msf_type":"auto"}'
    })
}

// 获取刮刮卡数量
function getCoin() {
    let anchor = text('还剩').findOne(5000)
    if (!anchor) {
        console.log('找不到累计控件')
        return false
    }
    let coin = anchor.parent().child(1).text()
    if (coin) {
        return parseInt(coin)
    } else {
        return false
    }
}

// 打开任务列表
function openTaskList() {
    console.log('打开任务列表')
    let taskListButton = text('得刮刮卡').findOne(20000)

    if (!taskListButton) {
        console.log('无法找到任务列表控件，请参照软件内的说明更换web内核。')
        quit()
    }
    taskListButton.click()
    console.log('等待任务列表')
    if (!idContains('taskContainer').findOne(5000)) {
        console.log('似乎没能打开任务列表，重试')
        taskListButton.click()
    }

    if (!idContains('taskContainer').findOne(5000)) {
        console.log('似乎没能打开任务列表，退出！')
        console.log('如果已经打开而未检测到，请参照软件内的说明更换web内核。')
        quit()
    }
}

// 关闭任务列表
function closeTaskList() {
    console.log('关闭任务列表')
    let anchor = idContains('taskContainer').findOne(5000)
    if (!anchor) {
        console.log('无法找到任务列表标识')
        return false
    }

    anchor = anchor.parent()

    let closeBtn = anchor.child(anchor.childCount() - 2) // tbs
    if (!closeBtn.clickable()) {
        closeBtn = anchor.child(anchor.childCount() - 1) // webview
    }

    return closeBtn.click()
}

// 重新打开任务列表
function reopenTaskList() {
    sleep(1000)
    closeTaskList()
    sleep(500)
    openTaskList()
}

// 获取未完成任务，根据数字标识，返回任务按钮、任务介绍、任务数量（数组）
function getTaskByText() {
    let tButton = null,
        tText = null,
        tCount = 0,
        tTitle = null
    console.log('寻找未完成任务...')
    let anchor = textMatches(/^(去完成|去打卡)$/).findOnce()
    if (anchor) { // 如果找不到任务，直接返回
        let tasks = anchor.parent().parent().children()
        // tasks.pop()
        // console.log(tasks[0].child(2))

        for (let i = 0; i < tasks.length; i++) {
            let task = tasks[i]
            try {
                tTitle = task.child(1).text()

                let r = task.child(2).text().match(/(\d*)\/(\d*)/)
                if (!r) continue
                tCount = (r[2] - r[1])

                // console.log(tTitle, tCount)

                button = task.child(4)

                if (tCount) { // 如果数字相减不为0，证明没完成
                    tText = task.child(3).text()
                    if (!autoJoin && tText.match(/入会|成为会员/)) continue
                    if (tTitle.match(/下单|小程序|裂变|白条|小游戏|更多好物|LBS|PLUS|购买商品|订阅/) || tText.match(/绑卡/)) continue
                    tButton = button
                    break
                }
            } catch (err) {
                console.log(err)
            }
        }
    } else {
        console.log('任务提示未找到')
    }
    return [tButton, tText, tCount, tTitle]
}

// 返回任务列表并检查是否成功，不成功重试一次，带有延时
function backToList() {
    if (idContains('taskContainer').findOnce()) {
        console.log('已经在任务列表')
        return
    }
    sleep(500)
    back()
    for (let i = 0; i < 5; i++) { // 尝试返回3次
        if (!idContains('taskContainer').findOne(2000)) {
            console.log('返回失败，重试返回')
            sleep(2000)
            back()
            continue
        } else {
            break
        }
    }
    sleep(3000)
}

// 浏览n秒的任务
function timeTask() {
    console.log('浏览任务8秒后自动返回...')
    sleep(8000)
    // let c = 0
    // while (c < 60) { // 0.5 * 40 = 20 秒，防止死循环
    //     if ((textMatches(/获得.*?刮刮卡/).exists() || descMatches(/获得.*?刮刮卡/).exists())) // 等待已完成出现
    //         break
    //     if ((textMatches(/已.*?浏.*?览/).exists() || descMatches(/已.*?浏.*?览/).exists())) { // 失败
    //         console.log('上限，返回刷新任务列表')
    //         return false
    //     }
    //     if ((textMatches(/出.*?错.*?了/).exists() || descMatches(/出.*?错.*?了/).exists())) {
    //         console.log('任务出错，返回刷新任务列表')
    //         return false
    //     }
    //     if (textMatches(/.*滑动浏览.*[^可]得.*/).exists()) {
    //         console.log('进行模拟滑动')
    //         swipe_flag = 1
    //         swipe(device.width / 2, device.height - 300, device.width / 2 + 20, device.height - 500, 1000)
    //         c = c + 2
    //     }

    //     // // 弹窗处理
    //     // let pop = text('升级开卡会员领好礼')
    //     // if (pop.exists()) {
    //     //     pop.findOnce().parent().parent().child(2).click()
    //     //     console.log('关闭会员弹窗')
    //     // }

    //     sleep(500)
    //     c++
    // }
    // if (c > 59) {
    //     console.log('未检测到任务完成标识。')
    //     return false
    // }
    console.log('已完成，准备返回')
    return true
}

// 入会任务
function joinTask() {
    let check = textMatches(/.*确认授权即同意.*|.*我的特权.*|.*立即开卡.*|.*解锁全部会员福利.*/).findOne(8000)
    if (!check) {
        console.log('无法找到入会按钮，判定为已经入会')
        return true
    } else if (check.text().match(/我的特权/)) {
        console.log('已经入会，返回')
        return true
    } else {
        sleep(2000)
        if (check.text().match(/.*立即开卡.*|.*解锁全部会员福利.*|授权解锁/)) {
            if (check.text() == '授权信息，解锁全部会员福利') {
                check = text('去升级').findOnce()
                if (!check) {
                    console.log('此类型无法找到升级按钮，入会失败')
                    return false
                }
            }

            let btn = check.bounds()
            console.log('即将点击开卡/解锁福利/升级，自动隐藏控制台')
            sleep(500)
            console.hide()
            sleep(500)
            click(btn.centerX(), btn.centerY())
            sleep(500)
            console.show()
            sleep(5000)
            check = textMatches(/.*确认授权即同意.*/).boundsInside(0, 0, device.width, device.height).findOne(8000)
        }

        if (!check) {
            console.log('无法找到入会按钮弹窗，加载失败')
            return false
        }

        if (check.indexInParent() == 2) {
            check = check.parent().child(1)
        } else if (check.indexInParent() == 0) {
            check = check.parent().parent().child(0)
        } else {
            let anchor = textContains('****').findOnce()
            check = anchor.parent().child(anchor.indexInParent() + 2)
            if (!check.bounds().top >= anchor.bounds().bottom) {
                console.log('使用第二种方法获取控件')
                let check1 = anchor.parent().children().findOne(filter(function (w) {
                    if (w.className().match(/ImageView/) && w.bounds().top >= anchor.bounds().bottom) {
                        return true
                    } else {
                        return false
                    }
                }))
                if (!check1) {
                    console.log('第二种方法也无法确认授权勾选框，失败。返回。')
                    return false
                } else {
                    check = check1
                    console.log('成功，继续')
                }
            }
        }

        console.log("最终[确认授权]前面选项框坐标为:", check.bounds());
        let x = check.bounds().centerX()
        let y = check.bounds().centerY()

        console.log('检测是否有遮挡')
        let float = className('android.widget.ImageView')
            .filter(function (w) {
                let b = w.bounds()
                return b.left <= x && b.right >= x && b.top <= y && b.bottom >= y && b.centerX() != x && b.centerY() != y
            }).findOnce()

        if (float) {
            console.log('有浮窗遮挡，尝试移除')
            if (device.sdkInt >= 24) {
                gesture(1000, [float.bounds().centerX(), float.bounds().centerY()], [float.bounds().centerX(), y + float.bounds().height()])
                console.log('已经进行移开操作，如果失败请反馈')
            } else {
                console.log('安卓版本低，无法自动移开浮窗，入会任务失败。至少需要安卓7.0。')
                return false
            }
        } else {
            console.log('未发现遮挡的浮窗，继续勾选')
        }

        console.log('即将勾选授权，自动隐藏控制台')
        sleep(500)
        console.hide()
        sleep(1000)
        click(x, y)
        sleep(500)
        console.show()

        console.log('准备点击入会按钮')
        let j = textMatches(/^确认授权(并加入店铺会员)*$|.*立即开通.*/).findOne(5000)
        if (!j) {
            console.log('无法找到入会按钮，失败')
            return false
        }
        sleep(1000)
        click(j.bounds().centerX(), j.bounds().centerY())
        sleep(1000)
        console.log('入会完成，返回')
        return true
    }
}

// 浏览商品和加购的任务，cart参数为是否加购的flag
function itemTask(cart) {
    console.log('等待进入商品列表...')
    let anchor = textContains('当前页').findOne(20000)
    if (!anchor) {
        console.log('未能进入商品列表。')
        return false
    }
    sleep(2000)

    if (anchor.parent().childCount() == 4) {
        console.log('任务重复完成，返回')
        return false
    }

    let items = textContains('.jpg!q70').find()
    for (let i = 0; i < items.length; i++) {
        console.log('浏览')
        let tmp = items[i].parent().parent()
        tmp.child(tmp.childCount() - 1).click()

        sleep(5000)
        console.log('返回')
        back()
        sleep(5000)
        let r = textContains('当前页').findOnce()
        if (!r) {
            back()
            sleep(5000)
        }
        if (i >= 4 - 1) {
            break
        }
    }
    return true
}

// 逛店任务 TODO: 618版本
function shopTask() {
    console.log('等待进入店铺列表...')
    let banner = textContains('喜欢').findOne(10000)
    if (!banner) {
        console.log('未能进入店铺列表。返回。')
        return false
    }
    let c = banner.text().match(/(\d)\/(\d*)/)
    if (!c) {
        c = 4 // 进行4次
    } else {
        c = c[2] - c[1]
    }
    sleep(2000)
    console.log('进行', c, '次')
    let like = text('喜欢').boundsInside(1, 0, device.width, device.height).findOnce()
    if (!like) {
        console.log('未能找到喜欢按钮。返回。')
        return false
    }
    let bound = [like.bounds().centerX(), like.bounds().centerY()]
    console.log('喜欢按钮位于', bound)
    for (let i = 0; i < c; i++) {
        click(bound[0], bound[1])
        console.log('浏览店铺页')
        sleep(8000)
        console.log('返回')
        back()
        sleep(5000)
        let r = textContains('喜欢').findOnce()
        if (!r) {
            back()
            sleep(5000)
        }
    }
    return true
}

// 参观任务
function viewTask() {
    console.log('进行参观任务')
    sleep(5000)
    console.log('参观任务直接返回')
    return true
}

// 品牌墙任务 TODO: 618版本
function wallTask() {
    console.log('进行品牌墙任务')
    sleep(3000)
    for (let i of [2, 3, 4, 5, 6]) { // 选5个
        console.log('打开一个')
        textContains('!q70').boundsInside(100, 100, device.width, device.height).findOnce(i).click()
        sleep(5000)
        console.log('直接返回')
        back()
        let r = textContains('!q70').findOne(8000)
        if (!r) back()
        sleep(3000)
    }
    // console.log('返回顶部')
    // let root = textContains('到底了').findOnce().parent().parent()
    // root.child(root.childCount() - 2).click()
    console.log('品牌墙完成后重新打开任务列表')
    sleep(3000)
    openTaskList()
    return true
}

// 单个任务的function，自动进入任务、自动返回任务列表，返回boolean
function doTask(tButton, tText, tTitle) {
    let clickFlag = tButton.click()
    // sleep(100);tButton.click();sleep(100);tButton.click() // 可能的阻碍
    let tFlag

    if (tButton.text() == '去领取') {
        tFlag = clickFlag // 打卡点击一次即可
        return tFlag
    }

    // if (tText.match(/品牌墙/) || tTitle.match(/品牌墙/)) {
    //     if (tTitle.match(/浏览更多权益/)) {
    //         console.log('简单品牌墙任务，等待10s')
    //         sleep(10000)
    //         return true
    //     }
    //     tFlag = wallTask()
    //     return tFlag // 品牌墙无需backToList，提前返回
    // } else 
    if (tText.match(/浏览.*秒|s/)) {
        console.log('进行', tText)
        tFlag = timeTask()
    }
    // else if (tText.match(/累计浏览/)) {
    //     console.log('进行累计浏览任务')
    //     if (tText.match(/加购/)) {
    //         tFlag = itemTask(true)
    //     } else {
    //         tFlag = itemTask(false)
    //     }
    // } 
    else if (tText.match(/成为会员|加入会员/)) {
        console.log(tTitle)
        console.log('进行入会任务')
        tFlag = joinTask()
    } else if (tText.match(/浏览可得|浏览可获得|晚会|参与|加购|关注/)) {
        // if (tTitle.match(/种草城/)) {
        //     tFlag = shopTask()
        // } else {
        // tFlag = viewTask()
        // }
        console.log(tTitle)
        tFlag = viewTask()
    }
    //  else if (tText.match(/打卡|首页/)) {
    //     tFlag = clickFlag // 打卡点击一次即可
    //     return tFlag
    // } else if (tText.match(/组队/)) {
    //     console.log('等待组队任务')
    //     sleep(3000)
    //     if (idContains('taskContainer').findOne(1000)) {
    //         console.log('当前仍在任务列表，说明已经完成任务且领取奖励，返回')
    //         return true
    //     } else {
    //         if (textContains('队伍刮刮卡').findOne(10000)) {
    //             console.log('进入到组队页面，返回')
    //             backToList()
    //             console.log('等待领取奖励')
    //             sleep(2000)
    //             tFlag = tButton.click()
    //             sleep(2000)
    //             return tFlag
    //         } else {
    //             console.log('未能进入组队')
    //             if (idContains('taskContainer').findOne(1000)) {
    //                 console.log('当前仍在任务列表，返回')
    //                 return true
    //             } else {
    //                 console.log('组队任务未检测到页面标识，视为已完成')
    //                 tFlag = false
    //             }
    //         }
    //     }
    // } 
    else {
        console.log('未知任务类型，默认为浏览任务', tText)
        tFlag = timeTask()
    }
    backToList()
    return tFlag
}

function signTask() {
    console.log('尝试关闭弹窗')

    let anchor = textMatches(/\+\d*刮刮卡/).findOnce();

    for (let i = 0; i < 5 && anchor; i++) {
        try {
            let tmp = anchor.parent().parent().child(0)
            if (!tmp.clickable()) {
                tmp = anchor.parent().parent().parent().child(0)
            }
            tmp.click()
            console.log('关闭')
            sleep(1000)
            anchor = textMatches(/\+\d*刮刮卡/).findOnce()
        } catch (err) {
            pass
        }
    }

    anchor = text('记录').findOne(5000)
    if (!anchor) {
        console.log('未能定位，签到失败')
        quit()
    }
    let sign
    if (anchor.indexInParent() < 3) {
        anchor = anchor.parent()
    }

    sign = anchor.parent().child(10)

    if (!sign.clickable()) {
        sign = anchor.parent().child(11)
    }

    sign.click()
    sleep(3000)

    anchor = text('提醒我每天签到').findOne(5000)

    if (!anchor) {
        console.log('未找到签到按钮')
        return false
    }

    anchor = anchor.parent().parent()

    sign = anchor.child(anchor.childCount() - 2)

    console.log('点击签到')
    return sign.click()
}

// 领取刮刮卡
function havestCoin() {
    console.log('准备领取自动积累的刮刮卡')
    let h = textMatches(/.*点击领取.*|.*后存满.*/).findOne(5000)
    if (h) {
        h.click()
        console.log('领取成功')
        sleep(8000)
    } else { console.log('未找到刮刮卡控件，领取失败') }
}

// 关闭主页的弹窗
function closePop() {
    let anchor = text('已放入首页＞记录').findOnce()
    if (!anchor) {
        console.log('寻找关闭弹窗按钮失败')
        return false
    }
    anchor = anchor.parent()
    return anchor.child(anchor.childCount() - 2).click()
}

let startCoin = null // 音量键需要

// 全局try catch，应对无法显示报错
try {
    if (autoOpen) {
        openAndInto()
        console.log('等待活动页面加载')
        if (!findTextDescMatchesTimeout(/.*得刮刮卡.*/, 20000)) {
            console.log('未能进入活动，请重新运行！')
            quit()
        }
        console.log('成功进入活动')
        sleep(2000)
        // scrollDown();

        openTaskList();
    } else {
        alert('请关闭弹窗后立刻手动打开京东App进入活动页面，并打开任务列表', '限时30秒')
        console.log('请手动打开京东App进入活动页面，并打开任务列表')
        if (!idContains('taskContainer').findOne(30000)) {
            console.log('未能进入活动，请重新运行！')
            quit()
        }
        console.log('成功进入活动')
    }

    sleep(5000)

    try {
        console.log('获取初始刮刮卡数量')
        startCoin = getCoin()
        console.log('当前共有' + startCoin + '刮刮卡')
    } catch (err) {
        console.log('获取刮刮卡失败，跳过', err)
    }

    // havestCoin()

    // 完成所有任务的循环
    while (true) {
        let [taskButton, taskText, taskCount, taskTitle] = getTaskByText()

        if (!taskButton) {

            // console.log('领取累计奖励')
            // textContains('去领取').find().forEach(function (e, i) {
            //     console.log('领取第' + (i + 1) + '个累计奖励')
            //     e.click()
            //     sleep(2000)
            // })

            // havestCoin()

            // console.log('最后进行签到任务')
            // let signT = signTask()

            let endCoin = null
            try {
                console.log('获取结束刮刮卡数量')
                endCoin = getCoin()
                console.log('当前共有' + endCoin + '刮刮卡')
            } catch (err) {
                console.log('获取刮刮卡失败，跳过', err)
            }

            console.log('没有可自动完成的任务了，退出。')
            console.log('互动任务、下单任务需要手动完成。')
            if (startCoin && endCoin) {
                console.log('本次运行获得' + (endCoin - startCoin) + '刮刮卡')
            } else {
                console.log('本次运行获得刮刮卡无法计算，具体原因请翻阅日志。')
            }

            alert('任务已完成', '别忘了在脚本主页领取618红包！')

            // if (!signT) {
            //     alert('本次签到失败', '请手动签到避免漏签（活动页右上角）')
            // }

            // alert('任务已完成', '互动任务手动完成之后还会有新任务，建议做完互动二次运行脚本')
            quit()
        }

        if (taskText.match(/品牌墙/) || taskTitle.match(/种草城/)) { // 品牌墙0/3只需要一次完成
            taskCount = 1
        }

        // 根据taskCount进行任务，一类任务一起完成，完成后刷新任务列表
        // console.log('进行' + taskCount + '次“' + taskText + '”类任务')
        // for (let i = 0; i < taskCount; i++) {
        //     console.log('第' + (i + 1) + '次')
        //     let taskFlag = doTask(taskButton, taskText, taskTitle)
        //     // if (text('已放入首页＞记录').exists()) {
        //     //     console.log('关闭奖励弹窗')
        //     //     closePop()
        //     //     sleep(3000)
        //     // }
        //     if (taskFlag) {
        //         console.log('完成，进行下一个任务')
        //         // gesture(1000, [100, 200], [100, 500], [100, 200])
        //     } else {
        //         console.log('任务失败，尝试重新打开任务列表获取任务')
        //         break // 直接退出，无需在此调用reopen
        //     }
        // }

        // 不刷新任务列表似乎会无法点击
        doTask(taskButton, taskText, taskTitle)
        console.log('重新打开任务列表')
        reopenTaskList()
    }
} catch (err) {
    device.cancelKeepingAwake()
    if (err.toString() != 'JavaException: com.stardust.autojs.runtime.exception.ScriptInterruptedException: null') {
        console.error(err)
        startCoin && console.log('本次任务开始时有' + startCoin + '刮刮卡')
    }
    showVersion()
}
