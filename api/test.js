module.exports = async (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Vercel Functions is working!',
        timestamp: new Date().toISOString(),
        env_check: {
            stripe_key_exists: !!process.env.STRIPE_SECRET_KEY,
            stripe_key_prefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NOT SET',
            price_initiate_exists: !!process.env.PRICE_ID_INITIATE,
            price_warrior_exists: !!process.env.PRICE_ID_WARRIOR,
            price_guardian_exists: !!process.env.PRICE_ID_GUARDIAN,
            node_version: process.version
        }
    });
};
