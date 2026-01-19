import { useEffect, useState } from 'react'
import { subscriptionsAPI, paymentsAPI } from '../services/api'
import toast from 'react-hot-toast'

const Plans = () => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      setLoading(true)
      const response = await subscriptionsAPI.getPlans()
      setPlans(response.data.data?.plans || [])
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId) => {
    try {
      setProcessing(planId)
      const response = await paymentsAPI.createCheckout(planId)
      // Redirect to Stripe checkout
      window.location.href = response.data.url
    } catch (error) {
      toast.error('Failed to create checkout session')
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Subscription Plans</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-slate-800 rounded-lg p-6 border border-slate-700"
          >
            <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold text-primary-400">
                ${plan.price}
              </span>
              <span className="text-gray-400 ml-2">
                /{plan.duration === 30 ? 'month' : plan.duration === 365 ? 'year' : `${plan.duration} days`}
              </span>
            </div>
            {plan.description && (
              <p className="text-gray-300 mb-4">{plan.description}</p>
            )}
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center text-gray-300">
                  <span className="text-primary-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={processing === plan.id}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg font-medium disabled:opacity-50"
            >
              {processing === plan.id ? 'Processing...' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No plans available</p>
        </div>
      )}
    </div>
  )
}

export default Plans
