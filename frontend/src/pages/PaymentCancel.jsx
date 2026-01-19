import { Link } from 'react-router-dom'

const PaymentCancel = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-slate-800 rounded-lg p-8 shadow-lg">
                    <div className="mb-6">
                        <div className="mx-auto w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
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
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-4">
                        Payment Cancelled
                    </h1>
                    <p className="text-gray-300 mb-6">
                        Your payment was cancelled. No charges were made to your account. You can try again whenever you're ready.
                    </p>
                    <div className="space-y-3">
                        <Link
                            to="/plans"
                            className="block w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                            View Plans
                        </Link>
                        <Link
                            to="/"
                            className="block w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                        >
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PaymentCancel
