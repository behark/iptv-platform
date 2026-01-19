import { forwardRef, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

const Input = forwardRef(({
  label,
  error,
  helperText,
  type = 'text',
  size = 'md',
  fullWidth = true,
  className = '',
  id,
  disabled = false,
  required = false,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPasswordType = type === 'password'
  const inputType = isPasswordType && showPassword ? 'text' : type
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  const baseInputClasses = 'block bg-slate-800 border text-white placeholder-slate-400 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

  const stateClasses = error
    ? 'border-red-500 focus:border-red-500'
    : 'border-slate-600 focus:border-primary-500 hover:border-slate-500'

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const widthClass = fullWidth ? 'w-full' : ''
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : ''
  const iconPaddingLeft = leftIcon ? 'pl-10' : ''
  const iconPaddingRight = rightIcon || isPasswordType ? 'pr-10' : ''

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`${baseInputClasses} ${stateClasses} ${sizeClasses[size]} ${widthClass} ${disabledClass} ${iconPaddingLeft} ${iconPaddingRight} ${className}`}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        )}
        {rightIcon && !isPasswordType && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-sm text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="mt-1.5 text-sm text-slate-400"
        >
          {helperText}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export const PasswordStrengthIndicator = ({ password }) => {
  const getStrength = (pwd) => {
    let score = 0
    if (!pwd) return { score: 0, label: '', color: '' }

    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { score: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 5) return { score: 3, label: 'Good', color: 'bg-green-500' }
    return { score: 4, label: 'Strong', color: 'bg-green-600' }
  }

  const strength = getStrength(password)
  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength.score ? strength.color : 'bg-slate-600'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        strength.score <= 1 ? 'text-red-400' :
        strength.score <= 2 ? 'text-yellow-400' : 'text-green-400'
      }`}>
        Password strength: {strength.label}
      </p>
    </div>
  )
}

export default Input
