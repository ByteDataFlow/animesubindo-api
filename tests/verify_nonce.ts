
import axios from 'axios';

const BASE_URL = 'https://otakudesu.blog';

async function check() {
    try {
        console.log("Checking Nonce with action 'aa1208d27f29ca340c92c66d1926f13f'...");
        const { data } = await axios.post(
            `${BASE_URL}/wp-admin/admin-ajax.php`,
            new URLSearchParams({ action: 'aa1208d27f29ca340c92c66d1926f13f' }),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        console.log("Response Status:", { success: data.success, data: data.data });

        if (data.data || data.success) {
            console.log("✅ SUCCESS: The action token is VALID.");
        } else {
            console.log("❌ FAILURE: The action token might be expired or invalid.");
        }

    } catch (e: any) {
        console.error("ERROR:", e.message);
    }
}

check();
