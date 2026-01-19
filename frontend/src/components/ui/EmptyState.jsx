import Button from './Button'

const EmptyState = ({
  icon,
  title,
  description,
  action,
  actionText,
  onAction,
  secondaryAction,
  secondaryActionText,
  onSecondaryAction,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {icon && (
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-slate-700 mb-4 text-slate-400">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-slate-400 max-w-sm mb-6">{description}</p>
      )}
      {(action || actionText) && (
        <div className="flex gap-3">
          {secondaryActionText && (
            <Button
              variant="secondary"
              onClick={onSecondaryAction}
            >
              {secondaryActionText}
            </Button>
          )}
          {actionText && (
            <Button
              variant="primary"
              onClick={onAction}
            >
              {actionText}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

export const NoResults = ({ query, onClear }) => (
  <EmptyState
    icon={
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    }
    title="No results found"
    description={query ? `No matches found for "${query}". Try adjusting your search or filters.` : 'No items match your current filters.'}
    actionText={onClear ? 'Clear filters' : undefined}
    onAction={onClear}
  />
)

export const NoData = ({ type = 'items', actionText, onAction }) => (
  <EmptyState
    icon={
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    }
    title={`No ${type} yet`}
    description={`Get started by adding your first ${type.slice(0, -1) || 'item'}.`}
    actionText={actionText}
    onAction={onAction}
  />
)

export const ErrorState = ({ message, onRetry }) => (
  <EmptyState
    icon={
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    }
    title="Something went wrong"
    description={message || 'An error occurred while loading the data. Please try again.'}
    actionText="Try again"
    onAction={onRetry}
  />
)

export const OfflineState = ({ onRetry }) => (
  <EmptyState
    icon={
      <svg className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
    }
    title="You're offline"
    description="Check your internet connection and try again."
    actionText="Retry"
    onAction={onRetry}
  />
)

export default EmptyState
