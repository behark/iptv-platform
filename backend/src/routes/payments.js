const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// @route   POST /api/payments/create-checkout
// @desc    Create Stripe checkout session
// @access  Private
router.post('/create-checkout', authenticate, async (req, res) => {
  try {
    const { planId } = req.body;

    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: plan.description
            },
            unit_amount: Math.round(plan.price * 100), // Convert to cents
            recurring: plan.duration === 30 ? {
              interval: 'month'
            } : plan.duration === 365 ? {
              interval: 'year'
            } : undefined
          },
          quantity: 1
        }
      ],
      mode: plan.duration === 30 || plan.duration === 365 ? 'subscription' : 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req.user.email,
      metadata: {
        userId: req.user.id,
        planId: plan.id
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook handler
// @access  Public (Stripe signature verification)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutCompleted(session) {
  const { userId, planId } = session.metadata;

  if (!userId || !planId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!plan) {
    console.error('Plan not found:', planId);
    return;
  }

  // Calculate end date
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.duration);

  // Cancel existing subscriptions
  await prisma.subscription.updateMany({
    where: {
      userId,
      status: 'ACTIVE'
    },
    data: {
      status: 'CANCELLED'
    }
  });

  // Create new subscription
  await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      endDate,
      stripeSubId: session.subscription || null,
      stripeCustId: session.customer || null
    }
  });
}

async function handleSubscriptionUpdate(subscription) {
  const status = subscription.status === 'active' ? 'ACTIVE' : 'CANCELLED';

  await prisma.subscription.updateMany({
    where: {
      stripeSubId: subscription.id
    },
    data: {
      status
    }
  });
}

module.exports = router;
