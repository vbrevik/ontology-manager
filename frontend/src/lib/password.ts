export function getPasswordStrength(password: string) {
    if (!password) return { label: '', color: 'bg-slate-200' };
    if (password.length < 6) return { label: 'Too Weak', color: 'bg-red-500' };
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const score = [hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (password.length >= 10 && score >= 2) return { label: 'Strong', color: 'bg-green-500' };
    if (password.length >= 8 && score >= 1) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Weak', color: 'bg-orange-500' };
}
