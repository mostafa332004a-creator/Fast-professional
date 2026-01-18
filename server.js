const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// إعداد البريد الإلكتروني
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'mostafa332004a@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// ملفات البيانات
const VISITORS_FILE = 'visitors.json';
const VISITS_LOG_FILE = 'visits_log.json';

// تهيئة ملفات البيانات
async function initDataFiles() {
    try {
        await fs.access(VISITORS_FILE);
    } catch {
        await fs.writeFile(VISITORS_FILE, JSON.stringify([]));
    }
    
    try {
        await fs.access(VISITS_LOG_FILE);
    } catch {
        await fs.writeFile(VISITS_LOG_FILE, JSON.stringify([]));
    }
}

initDataFiles();

// API لتلقي بيانات الزوار
app.post('/track-visitor', async (req, res) => {
    try {
        console.log('📥 استلام بيانات زائر:', req.body.ip);
        
        const visitorData = {
            ...req.body,
            receivedAt: new Date().toISOString(),
            serverTime: new Date().toLocaleString('ar-EG')
        };

        // حفظ في سجل الزيارات
        const visitsLog = JSON.parse(await fs.readFile(VISITS_LOG_FILE, 'utf8') || '[]');
        visitsLog.unshift({
            ...visitorData,
            logId: Date.now()
        });
        
        if (visitsLog.length > 1000) {
            visitsLog.length = 1000;
        }
        
        await fs.writeFile(VISITS_LOG_FILE, JSON.stringify(visitsLog, null, 2));

        // تحديث إحصائيات الزوار
        const visitors = JSON.parse(await fs.readFile(VISITORS_FILE, 'utf8') || '[]');
        const existingVisitorIndex = visitors.findIndex(v => v.ip === visitorData.ip);
        
        if (existingVisitorIndex !== -1) {
            visitors[existingVisitorIndex].visitCount++;
            visitors[existingVisitorIndex].lastVisit = visitorData.receivedAt;
            visitors[existingVisitorIndex].browser = visitorData.browser || visitors[existingVisitorIndex].browser;
            visitors[existingVisitorIndex].os = visitorData.os || visitors[existingVisitorIndex].os;
            visitors[existingVisitorIndex].location = visitorData.location || visitors[existingVisitorIndex].location;
            visitors[existingVisitorIndex].visits = visitors[existingVisitorIndex].visits || [];
            visitors[existingVisitorIndex].visits.push({
                time: visitorData.receivedAt,
                page: visitorData.pageUrl,
                referrer: visitorData.referrer
            });
        } else {
            visitors.unshift({
                ip: visitorData.ip,
                firstVisit: visitorData.receivedAt,
                lastVisit: visitorData.receivedAt,
                visitCount: 1,
                browser: visitorData.browser || 'غير معروف',
                os: visitorData.os || 'غير معروف',
                location: visitorData.location || 'غير معروف',
                screen: visitorData.screen || 'غير معروف',
                visits: [{
                    time: visitorData.receivedAt,
                    page: visitorData.pageUrl,
                    referrer: visitorData.referrer
                }]
            });
        }
        
        await fs.writeFile(VISITORS_FILE, JSON.stringify(visitors, null, 2));

        // إرسال البريد الإلكتروني
        await sendVisitorEmail(visitorData);

        res.json({
            success: true,
            message: 'تم تتبع الزائر بنجاح',
            visitorId: visitorData.ip,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// إرسال البريد الإلكتروني
async function sendVisitorEmail(visitorData) {
    try {
        const emailContent = `
            <div dir="rtl" style="font-family: 'Cairo', sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                <div style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #00a8e8, #0077b6); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">📊 تقرير زيارة جديدة</h1>
                        <p style="opacity: 0.9; margin-top: 10px;">المحترف السريع - نظام التتبع الآلي</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <div style="background: ${visitorData.visitCount === 1 ? '#e8f5e9' : '#fff3e0'}; padding: 20px; border-radius: 15px; margin-bottom: 25px; text-align: center;">
                            <h2 style="margin: 0; color: ${visitorData.visitCount === 1 ? '#2e7d32' : '#f57c00'};">${visitorData.visitCount === 1 ? '🎉 زيارة أولى' : '🔄 زيارة متكررة رقم ' + visitorData.visitCount}</h2>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 15px; overflow: hidden;">
                            <tr style="background: #f1f8ff;">
                                <td style="padding: 15px; font-weight: bold; color: #0077b6; border-bottom: 2px solid #e0e0e0;">🌐 عنوان IP</td>
                                <td style="padding: 15px; border-bottom: 2px solid #e0e0e0;">${visitorData.ip}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 15px; font-weight: bold; color: #0077b6; border-bottom: 2px solid #e0e0e0;">📍 الموقع</td>
                                <td style="padding: 15px; border-bottom: 2px solid #e0e0e0;">${visitorData.location || 'غير معروف'}</td>
                            </tr>
                            <tr style="background: white;">
                                <td style="padding: 15px; font-weight: bold; color: #0077b6; border-bottom: 2px solid #e0e0e0;">🖥️ المتصفح</td>
                                <td style="padding: 15px; border-bottom: 2px solid #e0e0e0;">${visitorData.browser || 'غير معروف'}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 15px; font-weight: bold; color: #0077b6; border-bottom: 2px solid #e0e0e0;">💻 نظام التشغيل</td>
                                <td style="padding: 15px; border-bottom: 2px solid #e0e0e0;">${visitorData.os || 'غير معروف'}</td>
                            </tr>
                            <tr style="background: white;">
                                <td style="padding: 15px; font-weight: bold; color: #0077b6;">⏰ وقت الزيارة</td>
                                <td style="padding: 15px;">${new Date().toLocaleString('ar-EG')}</td>
                            </tr>
                        </table>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #e9f7fe; border-radius: 15px; border-right: 5px solid #00a8e8;">
                            <h3 style="color: #0077b6; margin-top: 0;">🔗 معلومات إضافية</h3>
                            <p><strong>الصفحة:</strong> ${visitorData.pageUrl || 'غير معروف'}</p>
                            <p><strong>المصدر:</strong> ${visitorData.referrer || 'زيارة مباشرة'}</p>
                            <p><strong>الدقة:</strong> ${visitorData.screen || 'غير معروف'}</p>
                            <p><strong>اللغة:</strong> ${visitorData.language || 'غير معروف'}</p>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; color: #666;">
                        <p>📧 تم إرسال هذا التقرير تلقائياً من نظام تتبع زوار موقع المحترف السريع</p>
                        <p>⏰ ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: '"المحترف السريع - تتبع الزوار" <mostafa332004a@gmail.com>',
            to: 'mostafa332004a@gmail.com',
            subject: `${visitorData.visitCount === 1 ? '👤 زيارة جديدة' : '🔄 زيارة متكررة'} - ${visitorData.ip}`,
            html: emailContent
        });

        console.log('📧 تم إرسال البريد بنجاح');
    } catch (error) {
        console.error('❌ خطأ في إرسال البريد:', error);
    }
}

// API للإحصائيات
app.get('/api/stats', async (req, res) => {
    try {
        const visitors = JSON.parse(await fs.readFile(VISITORS_FILE, 'utf8') || '[]');
        const visitsLog = JSON.parse(await fs.readFile(VISITS_LOG_FILE, 'utf8') || '[]');
        
        const today = new Date().toDateString();
        const todayVisits = visitsLog.filter(v => 
            new Date(v.receivedAt).toDateString() === today
        ).length;

        res.json({
            totalVisitors: visitors.length,
            totalVisits: visitors.reduce((sum, v) => sum + v.visitCount, 0),
            todayVisits: todayVisits,
            uniqueToday: visitors.filter(v => 
                new Date(v.lastVisit).toDateString() === today
            ).length,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API لقائمة الزوار
app.get('/api/visitors', async (req, res) => {
    try {
        const visitors = JSON.parse(await fs.readFile(VISITORS_FILE, 'utf8') || '[]');
        const limit = parseInt(req.query.limit) || 50;
        
        res.json(visitors.slice(0, limit).map(v => ({
            ip: v.ip,
            visits: v.visitCount,
            lastVisit: v.lastVisit,
            browser: v.browser,
            location: v.location,
            firstVisit: v.firstVisit
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// صفحة لوحة التحكم
app.get('/admin', async (req, res) => {
    try {
        const visitors = JSON.parse(await fs.readFile(VISITORS_FILE, 'utf8') || '[]');
        const stats = JSON.parse(await fs.readFile(VISITS_LOG_FILE, 'utf8') || '[]');
        
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>لوحة تحكم التتبع</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
                    body { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; min-height: 100vh; padding: 20px; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 40px; padding: 30px; background: rgba(255,255,255,0.1); border-radius: 20px; backdrop-filter: blur(10px); }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
                    .stat-box { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
                    .stat-number { font-size: 2.5rem; font-weight: bold; color: #00a8e8; margin: 10px 0; }
                    .visitors-table { background: rgba(255,255,255,0.1); border-radius: 15px; overflow: hidden; backdrop-filter: blur(10px); }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: rgba(0,168,232,0.3); padding: 15px; text-align: right; }
                    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
                    tr:hover { background: rgba(255,255,255,0.05); }
                    .btn { display: inline-block; padding: 10px 20px; background: #00a8e8; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📊 لوحة تحكم تتبع الزوار</h1>
                        <p>المحترف السريع - ${new Date().toLocaleString('ar-EG')}</p>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div>👥 إجمالي الزوار</div>
                            <div class="stat-number">${visitors.length}</div>
                        </div>
                        <div class="stat-box">
                            <div>👁️ إجمالي الزيارات</div>
                            <div class="stat-number">${visitors.reduce((sum, v) => sum + v.visitCount, 0)}</div>
                        </div>
                        <div class="stat-box">
                            <div>📅 زيارات اليوم</div>
                            <div class="stat-number">${stats.filter(v => new Date(v.receivedAt).toDateString() === new Date().toDateString()).length}</div>
                        </div>
                        <div class="stat-box">
                            <div>⏰ آخر تحديث</div>
                            <div class="stat-number">${new Date().toLocaleTimeString('ar-EG')}</div>
                        </div>
                    </div>
                    
                    <div class="visitors-table">
                        <h3 style="padding: 20px; margin: 0;">آخر 20 زائر</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>الزيارات</th>
                                    <th>آخر زيارة</th>
                                    <th>المتصفح</th>
                                    <th>الموقع</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${visitors.slice(0, 20).map(v => `
                                    <tr>
                                        <td>${v.ip}</td>
                                        <td>${v.visitCount}</td>
                                        <td>${new Date(v.lastVisit).toLocaleString('ar-EG')}</td>
                                        <td>${v.browser}</td>
                                        <td>${v.location}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <button class="btn" onclick="location.reload()">🔄 تحديث</button>
                        <button class="btn" onclick="exportData()">📥 تصدير البيانات</button>
                        <button class="btn" onclick="window.location.href='/'">🏠 الرئيسية</button>
                    </div>
                </div>
                
                <script>
                    function exportData() {
                        const data = ${JSON.stringify(visitors.slice(0, 100))};
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'visitors-data.json';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('خطأ في تحميل البيانات');
    }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على: https://fast-professional.onrender.com`);
    console.log(`📧 البريد: mostafa332004a@gmail.com`);
    console.log(`📊 لوحة التحكم: https://fast-professional.onrender.com/admin`);
    console.log(`⏰ ${new Date().toLocaleString('ar-EG')}`);
});