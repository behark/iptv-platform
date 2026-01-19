import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams()
    const { checkAuth } = useAuth()
    const [loading, setLoading] = useState(true)
    const sessionId = searchParams.get('session_id')

    useEffect(() => {
        const refreshAuth = async () => {
            try {
                await checkAuth()
            } catch (error) {
                console.error('Error refreshing auth:', error)
            } finally {
                setLoading(false)
            }
        }

        refreshAuth()
    }, [checkAuth])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-slate-800 rounded-lg p-8 shadow-lg">
                    <div className="mb-6">
                        <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-4">
                        Payment Successful!
                    </h1>
                    <p className="text-gray-300 mb-6">
                        Thank you for your subscription. Your account has been upgraded and you now have access to all your plan's content.
                    </p>
                    {sessionId && (
                        <p className="text-sm text-gray-500 mb-6">
                            Session ID: {sessionId.slice(0, 20)}...
                        </p>
                    )}
                    <div className="space-y-3">
                        <Link
                            to="/channels"
                            className="block w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                            Browse Channels
                        </Link>
                        <Link
                            to="/profile"
                            className="block w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                            View Subscription
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PaymentSuccess
