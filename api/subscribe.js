const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ★ 販売開始日時（UTC）を設定
const SALE_START_TIME = new Date('2025-11-02T13:22:00Z');

module.exports = async (req, res) => {
    // ==========================================
    // CORS設定（最優先設定）
    // ==========================================
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://blockchain-lab.net');
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

    // =========================================
    // ★ 販売開始判定（最重要：ここに移動）
    // =========================================
    const now = new Date();
    if (now < SALE_START_TIME) {
        console.log('Sales not yet started. Current time:', now.toISOString(), 'Start time:', SALE_START_TIME.toISOString());
        res.status(403).json({
            status: 'error',
            message: '販売は2025年11月2日22時22分(JST)より開始となります。',
            debug: {
                current_time_utc: now.toISOString(),
                sale_start_time_utc: SALE_START_TIME.toISOString(),
                time_until_start_seconds: Math.ceil((SALE_START_TIME - now) / 1000)
            }
        });
        return; // ★ ここで終了！以降の処理は実行されない
    }

    console.log('Sales period is open. Proceeding with payment...');

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
            redirect_url: 'https://www.xtribe.me/join/contract-terms/' + plan
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
