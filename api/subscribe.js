const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエスト対応
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

        // 必須フィールドの検証
        if (!stripeToken || !email || !plan) {
            return res.status(400).json({
                status: 'error',
                message: '必須フィールドが不足しています。'
            });
        }

        // プランIDマッピング（環境変数から取得）
        const planMapping = {
            'initiate': process.env.PRICE_ID_INITIATE,
            'warrior': process.env.PRICE_ID_WARRIOR,
            'guardian': process.env.PRICE_ID_GUARDIAN
        };

        if (!planMapping[plan]) {
            return res.status(400).json({
                status: 'error',
                message: '無効なプランが選択されています。'
            });
        }

        // 1. 顧客を作成
        const customer = await stripe.customers.create({
            email: email,
            name: name || '名無し',
            source: stripeToken,
            metadata: {
                plan: plan,
                signup_date: new Date().toISOString()
            }
        });

        console.log('Customer created:', customer.id);

        // 2. サブスクリプションを作成
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: planMapping[plan] }],
            metadata: {
                customer_name: name,
                plan_type: plan
            }
        });

        console.log('Subscription created:', subscription.id);

        // 3. 成功レスポンス
        return res.status(200).json({
            status: 'success',
            subscription_id: subscription.id,
            customer_id: customer.id,
            redirect_url: '/tribe-contractl?plan=' + plan
        });

    } catch (error) {
        console.error('Stripe Error:', error);

        // エラータイプ別の処理
        if (error.type === 'StripeCardError') {
            const errorMessages = {
                'card_declined': 'カードが拒否されました。別のカードをお試しください。',
                'expired_card': 'カードの有効期限が切れています。',
                'incorrect_cvc': 'セキュリティコード（CVC）が正しくありません。',
                'processing_error': 'カード処理中にエラーが発生しました。',
                'incorrect_number': 'カード番号が正しくありません。',
                'insufficient_funds': 'カードの残高が不足しています。'
            };

            return res.status(400).json({
                status: 'error',
                error_type: 'card_error',
                error_code: error.code,
                message: errorMessages[error.code] || error.message
            });
        }

        // その他のエラー
        return res.status(500).json({
            status: 'error',
            error_type: 'api_error',
            message: error.message || 'サーバーエラーが発生しました。'
        });
    }
};
