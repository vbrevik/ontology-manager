import { useState, useEffect } from 'react'

interface PasswordStrengthIndicatorProps {
  password: string
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState(0)
  const [feedback, setFeedback] = useState<string[]>([])

  useEffect(() => {
    if (password.length === 0) {
      setStrength(0)
      setFeedback([])
      return
    }

    let score = 0
    const feedbackMessages: string[] = []

    // Length check
    if (password.length >= 8) {
      score += 1
    } else {
      feedbackMessages.push('At least 8 characters')
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      feedbackMessages.push('Include uppercase letters')
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      feedbackMessages.push('Include lowercase letters')
    }

    // Number check
    if (/[0-9]/.test(password)) {
      score += 1
    } else {
      feedbackMessages.push('Include numbers')
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1
    } else {
      feedbackMessages.push('Include special characters')
    }

    setStrength(score)
    setFeedback(feedbackMessages)
  }, [password])

  const getStrengthLabel = () => {
    if (strength <= 2) return 'Weak'
    if (strength <= 4) return 'Medium'
    if (strength === 5) return 'Strong'
    return 'Very Strong'
  }

  const getStrengthColor = () => {
    if (strength <= 2) return 'bg-red-500'
    if (strength <= 4) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStrengthWidth = () => {
    return `${(strength / 5) * 100}%`
  }

  return (
    <div className="mt-2">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Strength</span>
        <span className={`text-sm font-medium ${strength <= 2 ? 'text-red-600' : strength <= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
          {getStrengthLabel()}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div 
          className={`h-2 rounded-full ${getStrengthColor()} transition-all duration-300 ease-in-out`}
          style={{ width: getStrengthWidth() }}
        ></div>
      </div>
      {feedback.length > 0 && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium">Suggestions:</p>
          <ul className="list-disc pl-5 space-y-1">
            {feedback.map((msg, index) => (
              <li key={index}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
