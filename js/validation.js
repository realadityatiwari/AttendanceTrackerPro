export function validateRollNumber(roll) {
  if (!roll) return { valid: false, message: "Roll Number is required." };
  if (!/^\d{13}$/.test(roll)) {
    return { valid: false, message: "Roll Number must be exactly 13 digits." };
  }
  return { valid: true };
}

export function validatePassword(password) {
  if (!password) return { valid: false, message: "Password is required." };
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }
  return { valid: true };
}

export function validateSignupForm(name, roll, pass, confirmPass) {
  if (!name.trim()) return { valid: false, message: "Name is required." };
  
  const rollCheck = validateRollNumber(roll);
  if (!rollCheck.valid) return rollCheck;

  const passCheck = validatePassword(pass);
  if (!passCheck.valid) return passCheck;

  if (pass !== confirmPass) {
    return { valid: false, message: "Passwords do not match." };
  }

  return { valid: true };
}
