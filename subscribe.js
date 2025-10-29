const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // ==========================================
    // CORS設定（最優先で設定）
    // ==========================================
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://nb2685.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // OPTIONSリクエスト（プリフライト）を即座に返す
    if (req.method === 'OPTIONS') {
        console.log('OPTIONS request received');
        res.status(200).end();
        return;
    }

    // POSTリクエストのみ受け付け
    if (req.method !== 'POST') {
        console.log('Non-POST request:', req.method);
        res.status(405).json({
            status: 'error',
            message: 'Method Not Allowed'
        });
        return;
    }

    console.log('POST request received');
    console.log('Body:', req.body);

    try {
        const { stripeToken, name, email, plan } = req.body;

        // バリデーション
        if (!stripeToken || !email || !plan) {
            console.log('Missing required fields');
            res.status(400).json({
                status: 'error',
                message: '必須フィールドが不足しています。'
            });
            return;
        }

        // 環境変数チェック
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not set');
            res.status(500).json({
                status: 'error',
                message: 'サーバー設定エラー'
            });
            return;
        }

        // プランマッピング
        const planMapping = {
            'initiate': process.env.PRICE_ID_INITIATE,
            'warrior': process.env.PRICE_ID_WARRIOR,
            'guardian': process.env.PRICE_ID_GUARDIAN
        };

        if (!planMapping[plan]) {
            console.log('Invalid plan:', plan);
            res.status(400).json({
                status: 'error',
                message: '無効なプランです。'
            });
            return;
        }

        console.log('Creating Stripe customer...');

        // Stripe顧客作成
        const customer = await stripe.customers.create({
            email: email,
            name: name || '名無し',
            source: stripeToken,
            metadata: { plan: plan }
        });

        console.log('Customer created:', customer.id);

        // サブスクリプション作成
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: planMapping[plan] }]
        });

        console.log('Subscription created:', subscription.id);

        // 成功レスポンス
        res.status(200).json({
            status: 'success',
            subscription_id: subscription.id,
            customer_id: customer.id,
            redirect_url: '/thank-you.html?plan=' + plan
        });

    } catch (error) {
        console.error('Error:', error);

        if (error.type === 'StripeCardError') {
            res.status(400).json({
                status: 'error',
                error_type: 'card_error',
                error_code: error.code,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            status: 'error',
            error_type: 'api_error',
            message: error.message || 'サーバーエラー'
        });
    }
};
