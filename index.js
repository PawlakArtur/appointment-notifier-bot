import 'dotenv/config';
import http from 'http';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CALENDAR_ID = 'OY1oLR7CHR1SVF9C19Vfcg';

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('BŁĄD: Brak zmiennych TELEGRAM_TOKEN lub TELEGRAM_CHAT_ID!');
    process.exit(1);
}

let lastSeenDays = null;

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text })
        });
        console.log('Wysłano powiadomienie na Telegram.');
    } catch (err) {
        console.error('Błąd wysyłania do Telegrama:', err);
    }
}

async function checkCalendar() {
    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30);

        const fromDateStr = formatDate(today);
        const toDateStr = formatDate(futureDate);

        const apiUrl = `https://backend.zarejestrowani.pl/api/v1/public/timetable/${CALENDAR_ID}/?type=1&from_date=${fromDateStr}&to_date=${toDateStr}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pl,en;q=0.9',
                'cache-control': 'no-cache',
                'pragma': 'no-cache',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Błąd API Zarejestrowani: ${response.status}`);
            return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const bodyPreview = (await response.text()).slice(0, 160).replace(/\s+/g, ' ');
            console.error(`Oczekiwano JSON z kalendarza, otrzymano ${contentType || 'nieznany typ'}: ${bodyPreview}`);
            return;
        }

        const data = await response.json();
        let daysObj = {};

        if (typeof data.days === 'string') {
            daysObj = JSON.parse(data.days);
        } else if (typeof data.days === 'object' && data.days !== null) {
            daysObj = data.days;
        }

        const currentAvailableDays = Object.keys(daysObj).sort();

        if (lastSeenDays === null) {
            lastSeenDays = currentAvailableDays;
            console.log(`[${new Date().toLocaleTimeString()}] Stan początkowy zapisany. Dostępne dni:`, currentAvailableDays);
            return;
        }

        const addedDays = currentAvailableDays.filter(day => !lastSeenDays.includes(day));

        if (addedDays.length > 0) {
            const datesText = addedDays.join(', ');
            const message = `🚨 NOWY TERMIN W KALENDARZU!\n\nDostępne dni: ${datesText}\n\nRezerwuj: https://zarejestrowani.pl/${CALENDAR_ID}`;
            await sendTelegramMessage(message);
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] Brak nowych terminów.`);
        }

        lastSeenDays = currentAvailableDays;
    } catch (error) {
        console.error('Błąd sprawdzania kalendarza:', error);
    }
}

function startBot() {
    checkCalendar();
    const randomInterval = Math.floor(Math.random() * (360000 - 240000 + 1)) + 240000;
    setTimeout(startBot, randomInterval);
}

// Mini-serwer HTTP wymagany przez darmowe hostingi (np. Render) do utrzymania procesu przy życiu
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot działa poprawnie.');
}).listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie ${PORT}`);
    sendTelegramMessage('✅ Test: Bot wystartował i ma połączenie z Telegramem!');
    startBot();
});
