// tracker.js - يمكن إضافته لأي موقع
(function() {
    'use strict';
    
    const TRACKER_VERSION = '2.0.0';
    const SERVER_URL = 'https://fast-professional.onrender.com';
    
    class VisitorTracker {
        constructor() {
            this.initialized = false;
            this.visitorData = null;
            this.config = {
                trackPageViews: true,
                trackClicks: false,
                trackScroll: false,
                trackTime: true,
                debug: false
            };
        }
        
        async init(config = {}) {
            if (this.initialized) return;
            
            this.config = { ...this.config, ...config };
            this.visitorData = await this.collectData();
            
            if (this.config.trackPageViews) {
                this.trackPageView();
            }
            
            if (this.config.trackClicks) {
                this.trackClicks();
            }
            
            if (this.config.trackScroll) {
                this.trackScroll();
            }
            
            if (this.config.trackTime) {
                this.trackTimeOnSite();
            }
            
            await this.sendToServer();
            this.initialized = true;
            
            if (this.config.debug) {
                console.log('🔍 Visitor Tracker Initialized:', this.visitorData);
            }
        }
        
        async collectData() {
            try {
                // الحصول على IP
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const { ip } = await ipResponse.json();
                
                // معلومات الموقع الجغرافي
                let location = 'غير معروف';
                try {
                    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
                    const geoData = await geoResponse.json();
                    location = `${geoData.city || ''}, ${geoData.country_name || ''}`;
                } catch (error) {
                    try {
                        const geoResponse = await fetch(`https://ipinfo.io/${ip}/json`);
                        const geoData = await geoResponse.json();
                        location = `${geoData.city}, ${geoData.country}`;
                    } catch (e) {
                        location = 'غير معروف';
                    }
                }
                
                // معلومات المتصفح
                const ua = navigator.userAgent;
                const browser = this.detectBrowser(ua);
                const os = this.detectOS(ua);
                const device = this.detectDevice(ua);
                
                // حساب عدد الزيارات
                const storageKey = `vt_${ip}`;
                let visitData = JSON.parse(localStorage.getItem(storageKey) || '{"count": 0, "firstVisit": ""}');
                
                visitData.count++;
                if (!visitData.firstVisit) {
                    visitData.firstVisit = new Date().toISOString();
                }
                visitData.lastVisit = new Date().toISOString();
                localStorage.setItem(storageKey, JSON.stringify(visitData));
                
                return {
                    ip: ip,
                    location: location.trim(),
                    browser: browser,
                    os: os,
                    device: device,
                    screen: `${screen.width}x${screen.height}`,
                    colorDepth: screen.colorDepth,
                    language: navigator.language,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    pageUrl: window.location.href,
                    referrer: document.referrer || 'مباشر',
                    visitCount: visitData.count,
                    firstVisit: visitData.firstVisit,
                    lastVisit: visitData.lastVisit,
                    sessionStart: new Date().toISOString(),
                    trackerVersion: TRACKER_VERSION,
                    userAgent: ua
                };
                
            } catch (error) {
                console.error('Visitor Tracker Error:', error);
                return null;
            }
        }
        
        detectBrowser(ua) {
            if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
            if (ua.includes('Edg')) return 'Edge';
            if (ua.includes('MSIE') || ua.includes('Trident')) return 'IE';
            return 'غير معروف';
        }
        
        detectOS(ua) {
            if (ua.includes('Windows')) return 'Windows';
            if (ua.includes('Mac')) return 'macOS';
            if (ua.includes('Linux')) return 'Linux';
            if (ua.includes('Android')) return 'Android';
            if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
            return 'غير معروف';
        }
        
        detectDevice(ua) {
            if (/Mobi|Android/i.test(ua)) return 'Mobile';
            if (/Tablet|iPad/i.test(ua)) return 'Tablet';
            return 'Desktop';
        }
        
        trackPageView() {
            const pageData = {
                pageTitle: document.title,
                pageUrl: window.location.href,
                timestamp: new Date().toISOString()
            };
            
            this.saveEvent('page_view', pageData);
        }
        
        trackClicks() {
            document.addEventListener('click', (e) => {
                const target = e.target;
                const clickData = {
                    tag: target.tagName,
                    id: target.id || 'none',
                    class: target.className || 'none',
                    text: target.textContent?.substring(0, 100) || 'none',
                    href: target.href || 'none',
                    timestamp: new Date().toISOString()
                };
                
                this.saveEvent('click', clickData);
            }, { capture: true });
        }
        
        trackScroll() {
            let lastScroll = 0;
            let scrollTimeout;
            
            window.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const currentScroll = window.scrollY;
                    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                    const percentage = maxScroll > 0 ? Math.round((currentScroll / maxScroll) * 100) : 0;
                    
                    if (Math.abs(currentScroll - lastScroll) > 100) {
                        this.saveEvent('scroll', {
                            percentage: percentage,
                            position: currentScroll,
                            timestamp: new Date().toISOString()
                        });
                        lastScroll = currentScroll;
                    }
                }, 100);
            });
        }
        
        trackTimeOnSite() {
            let startTime = Date.now();
            
            window.addEventListener('beforeunload', () => {
                const timeSpent = Math.round((Date.now() - startTime) / 1000);
                this.saveEvent('session_end', {
                    timeSpent: timeSpent,
                    timestamp: new Date().toISOString()
                });
                
                // محاولة إرسال البيانات المتبقية
                this.sendPendingEvents();
            });
        }
        
        saveEvent(type, data) {
            if (!this.visitorData) return;
            
            const events = JSON.parse(localStorage.getItem('vt_events') || '[]');
            events.push({
                type: type,
                data: data,
                visitorId: this.visitorData.ip,
                timestamp: new Date().toISOString()
            });
            
            // حفظ آخر 100 حدث فقط
            if (events.length > 100) {
                events.splice(0, events.length - 100);
            }
            
            localStorage.setItem('vt_events', JSON.stringify(events));
        }
        
        async sendToServer() {
            if (!this.visitorData) return;
            
            try {
                const events = JSON.parse(localStorage.getItem('vt_events') || '[]');
                const payload = {
                    ...this.visitorData,
                    events: events.slice(-10) // إرسال آخر 10 أحداث فقط
                };
                
                const response = await fetch(`${SERVER_URL}/track-visitor`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // مسح الأحداث بعد الإرسال الناجح
                    localStorage.removeItem('vt_events');
                    
                    if (this.config.debug) {
                        console.log('✅ تم إرسال بيانات الزائر بنجاح');
                    }
                }
                
            } catch (error) {
                if (this.config.debug) {
                    console.warn('⚠️ لم يتمكن من إرسال البيانات:', error.message);
                }
            }
        }
        
        async sendPendingEvents() {
            try {
                navigator.sendBeacon(`${SERVER_URL}/track-visitor`, 
                    JSON.stringify({
                        ...this.visitorData,
                        events: JSON.parse(localStorage.getItem('vt_events') || '[]'),
                        sessionEnd: true,
                        timestamp: new Date().toISOString()
                    })
                );
            } catch (error) {
                console.log('⚠️ لم يتمكن من إرسال البيانات النهائية');
            }
        }
        
        // وظائف للمطورين
        getVisitorData() {
            return this.visitorData;
        }
        
        getEvents() {
            return JSON.parse(localStorage.getItem('vt_events') || '[]');
        }
        
        clearData() {
            localStorage.removeItem('vt_events');
            const keys = Object.keys(localStorage).filter(key => key.startsWith('vt_'));
            keys.forEach(key => localStorage.removeItem(key));
            console.log('🧹 تم مسح بيانات التتبع');
        }
    }
    
    // إنشاء نسخة عامة
    window.VisitorTracker = VisitorTracker;
    
    // البدء التلقائي
    if (typeof window !== 'undefined') {
        const tracker = new VisitorTracker();
        
        // بدء التتبع بعد تحميل الصفحة
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => tracker.init(), 1000);
            });
        } else {
            setTimeout(() => tracker.init(), 1000);
        }
        
        // تعيين global للوصول
        window.__visitorTracker = tracker;
    }
    
})();