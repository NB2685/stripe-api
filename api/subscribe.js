const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// CORS設定を関数の外で定義
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400'
};

module.exports = async (req, res) => {
    // すべてのレスポンスにCORSヘッダーを設定
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // OPTIONSリクエスト（プリフライト）
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POSTリクエストのみ受け付け
    if (req.method !== 'POST') {
        return res.status(405).json({
            status: 'error',
            message: 'Method Not Allowed'
        });
    }

    try {
        const { stripeToken, name, email, plan } = req.body;

        // バリデーション
        if (!stripeToken || !email || !plan) {
            return res.status(400).json({
                status: 'error',
                message: '必須フィールドが不足しています。'
            });
        }

        // 環境変数チェック
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                status: 'error',
                message: 'Stripe APIキーが設定されていません。'
            });
        }

        const planMapping = {
            'initiate': process.env.PRICE_ID_INITIATE,
            'warrior': process.env.PRICE_ID_WARRIOR,
            'guardian': process.env.PRICE_ID_GUARDIAN
        };

        if (!planMapping[plan] || !planMapping[plan]) {
            return res.status(400).json({
                status: 'error',
                message: '無効なプランです。'
            });
        }

        // Stripe処理
        const customer = await stripe.customers.create({
            email: email,
            name: name || '名無し',
            source: stripeToken,
            metadata: { plan: plan }
        });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: planMapping[plan] }]
        });

        return res.status(200).json({
            status: 'success',
            subscription_id: subscription.id,
            customer_id: customer.id,
            redirect_url: '/thank-you.html?plan=' + plan
        });

    } catch (error) {
        console.error('Error:', error);

        if (error.type === 'StripeCardError') {
            return res.status(400).json({
                status: 'error',
                error_type: 'card_error',
                error_code: error.code,
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            error_type: 'api_error',
            message: error.message
        });
    }
};
