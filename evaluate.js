const puppeteer = require('puppeteer'); // v23.0.0 or later

// --- 配置部分 ---
const LOGIN_CREDENTIALS = {
    username: 'Your_Student_ID', // <--- 学号
    password: 'Your_Password'  // <--- 密码
};

const SCORES = {
    defaultScore: '10' // 评分项目预设分数
};

const CONFIG = {
    timeout: 20000, // 单位：毫秒，Puppeteer 的全局超时时间
    headless: false, // false代表可视化
    viewport: {
        width: 1920,
        height: 1080
    }
};

async function login(page) {
    console.log('正在導航至登入頁面...');
    await page.goto('http://class.****.edu.cn:2333/FuckYou/');
    console.log('正在輸入帳號和密碼...');
    await page.type('#username', LOGIN_CREDENTIALS.username);
    await page.type('#password', LOGIN_CREDENTIALS.password);
    console.log('正在登入按鈕...');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('#Submit')
    ]);
    console.log('登入成功！');
}

/**
 * 等待用户手动点进教学评价界面并同意所有须知
 * @param {import('puppeteer').Page} page
 */
async function navigateToEvaluation(page) {
    console.log('请手动点击进入「教学评价」界面，并同意所有须知后，按下回车继续...');
    process.stdin.resume();
    await new Promise(resolve => process.stdin.once('data', resolve));
    process.stdin.pause();
    console.log('已操作，继续执行...');
}

/**
 * 核心函式：自動尋找並完成所有未評價的項目
 * @param {import('puppeteer').Frame} initialFrame - 評教系統所在的 Frame
 * @param {import('puppeteer').Page} page - Puppeteer Page 物件
 */
async function evaluateAllPending(initialFrame, page) {
    let frame = initialFrame;
    console.log('已進入評教列表頁面。');

    let evaluationsCompleted = 0;
    while (true) {
        let target = null;
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (frame.isDetached()) {
                console.log('Frame已分离，重新获取iframe...');
                const newFrame = page.mainFrame().childFrames()[0];
                if (!newFrame) {
                    throw new Error('无法重新获取iframe！');
                }
                frame = newFrame;
            }
            console.log('\n正在掃描未評價的課程...');
            
            // 确保页面已加载完成
            await frame.waitForSelector('#courseID', { timeout: 10000 });
            
            target = await frame.evaluate(() => {
                const isEvaluated = (option) => option.textContent.includes('(已评)');
                const isDefaultOption = (option) => {
                    const text = option.textContent.trim();
                    return text.includes('请选择') || text.includes('选择') || !option.value || option.value === '';
                };
                
                const courseSelect = document.querySelector('#courseID');
                if (!courseSelect) return null;
                
                const targetCourseOption = Array.from(courseSelect.options).find(opt => 
                    opt.value && 
                    !isEvaluated(opt) && 
                    !isDefaultOption(opt)
                );
                
                if (!targetCourseOption) return null;
                return {
                    courseValue: targetCourseOption.value,
                    courseName: targetCourseOption.textContent.trim()
                };
            });
        } catch (error) {
            console.log('获取课程信息时发生错误，尝试重新获取iframe...', error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新获取iframe
            const newFrame = page.mainFrame().childFrames()[0];
            if (!newFrame) {
                throw new Error('无法重新获取iframe！');
            }
            frame = newFrame;
            continue;
        }
        
        if (!target) {
            console.log('*** 所有課程均已評價完畢！ ***');
            break;
        }        try {
            console.log(`發現未評教課程: 【${target.courseName}】，正在選擇...`);
            
            // 使用 fill 方法选择课程
            await frame.waitForSelector('#courseID', { timeout: 10000 });
            await frame.evaluate((courseValue) => {
                const courseSelect = document.querySelector('#courseID');
                if (courseSelect) {
                    courseSelect.value = courseValue;
                    // 触发change事件
                    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, target.courseValue);
            
            // 等待页面更新
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 等待教师选择框更新
            await frame.waitForSelector('#teacherID', { timeout: 10000 });

            const teacherTarget = await frame.evaluate(() => {
                 const isEvaluated = (option) => option.textContent.includes('(已评)');
                 const isDefaultOption = (option) => {
                     const text = option.textContent.trim();
                     return text.includes('请选择') || text.includes('选择') || !option.value || option.value === '';
                 };
                 
                 const teacherSelect = document.querySelector('#teacherID');
                 if (!teacherSelect) return null;
                 
                 const targetTeacherOption = Array.from(teacherSelect.options).find(opt => 
                     opt.value && 
                     !isEvaluated(opt) && 
                     !isDefaultOption(opt)
                 );
                 
                 if(!targetTeacherOption) return null;
                 return {
                     teacherValue: targetTeacherOption.value,
                     teacherName: targetTeacherOption.textContent.trim()
                 }
            });

            if (!teacherTarget) {
                console.log(`課程 ${target.courseName} 下沒有需要評價的教師，繼續掃描下一個課程。`);
                continue;
            }
            
            console.log(`  └- 正在選擇教師: 【${teacherTarget.teacherName}】`);
            
            // 使用 fill 方法选择教师
            await frame.evaluate((teacherValue) => {
                const teacherSelect = document.querySelector('#teacherID');
                if (teacherSelect) {
                    teacherSelect.value = teacherValue;
                    // 触发change事件
                    teacherSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, teacherTarget.teacherValue);
            
            // 等待评分页面加载
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 等待评分表单加载
            await frame.waitForSelector('#evaluateScore1', { timeout: 10000 });

            console.log('  └- 正在填寫評分...');
            
            // 清空并填写所有评分项
            for (let i = 1; i <= 10; i++) {
                const scoreSelector = `#evaluateScore${i}`;
                try {
                    await frame.waitForSelector(scoreSelector, { visible: true, timeout: 5000 });
                    
                    // 清空输入框
                    await frame.evaluate((selector) => {
                        const input = document.querySelector(selector);
                        if (input) {
                            input.value = '';
                            input.focus();
                        }
                    }, scoreSelector);
                    
                    // 输入新值
                    await frame.type(scoreSelector, SCORES.defaultScore);
                } catch (scoreError) {
                    console.log(`评分项 ${i} 可能不存在，跳过...`);
                }
            }
            
            console.log('  └- 正在提交...');
            
            // 构造正确的表单提交
            await frame.evaluate((defaultScore) => {
                // 获取表单参数
                const year = document.querySelector('input[name="year"]')?.value || '2024';
                const term = document.querySelector('input[name="term"]')?.value || '2';
                const studentID = document.querySelector('input[name="studentID"]')?.value || '';
                const courseID = document.querySelector('#courseID')?.value || '';
                const teacherID = document.querySelector('#teacherID')?.value || '';
                
                // 构造表单数据
                const formData = new FormData();
                formData.append('year', year);
                formData.append('term', term);
                formData.append('studentID', studentID);
                formData.append('courseID', courseID);
                formData.append('teacherID', teacherID);
                
                // 添加所有评分项
                for (let i = 1; i <= 10; i++) {
                    const scoreInput = document.querySelector(`#evaluateScore${i}`);
                    if (scoreInput) {
                        formData.append('evaluateScore', defaultScore);
                        formData.append('evaluateEntryID', i.toString());
                    }
                }
                
                // 添加其他必要参数
                formData.append('courseOpinionSuggest', '');
                formData.append('sumScore', parseFloat(defaultScore).toFixed(1));
                formData.append('grade', '优秀');
                formData.append('doSave', '  确定  ');
                
                // 获取表单的action URL
                const form = document.querySelector('form');
                const actionUrl = form ? form.action : window.location.href;
                
                // 提交表单
                fetch(actionUrl, {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                }).then(response => {
                    if (response.ok) {
                        // 提交成功后刷新页面或返回列表
                        window.location.reload();
                    }
                }).catch(error => {
                    console.error('提交失败:', error);
                    // 如果fetch失败，尝试传统方式提交
                    const submitBtn = document.querySelector('input[value*="确定"]') || 
                                    document.querySelector('input[value*="确 定"]');
                    if (submitBtn) {
                        submitBtn.click();
                    }
                });
            }, SCORES.defaultScore);
            
            // 等待提交完成
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            evaluationsCompleted++;
            console.log(`--- 【${target.courseName} - ${teacherTarget.teacherName}】評價成功！已累計完成 ${evaluationsCompleted} 項。 ---`);
            
        } catch (selectError) {
            console.error(`处理课程 ${target.courseName} 时发生错误:`, selectError.message);
            console.log('尝试继续处理下一个课程...');
            
            // 重新获取iframe以防连接断开
            try {
                const newFrame = page.mainFrame().childFrames()[0];
                if (newFrame) {
                    frame = newFrame;
                }
            } catch (frameError) {
                console.error('重新获取iframe失败:', frameError.message);
            }
            continue;
        }
    }
}


// --- 主執行函式 ---
(async () => {
    const browser = await puppeteer.launch({ headless: CONFIG.headless });
    const page = await browser.newPage();
    page.setDefaultTimeout(CONFIG.timeout);
    await page.setViewport(CONFIG.viewport);

    try {
        await login(page);
        
        await navigateToEvaluation(page);
        // 在進入新頁面後，尋找評教表單所在的 iframe
        console.log('正在尋找評教系統的 iframe...');
        await page.waitForSelector('iframe');

        let evaluationFrame = page.mainFrame().childFrames()[0]; 
        if (!evaluationFrame) {
            throw new Error('無法在教學評價頁面中找到對應的 iframe！');
        }
        console.log('已成功定位到評教系統 iframe，開始執行全自動評教。');

        await evaluateAllPending(evaluationFrame, page);

    } catch (err) {
        console.error('執行過程中發生錯誤:', err);
        // 如果需要，儲存錯誤截圖
        await page.screenshot({ path: 'error_screenshot.png' });
    } finally {
        // 根据需要關閉瀏覽器
        await browser.close();
        console.log('瀏覽器已關閉。');
    }
})();