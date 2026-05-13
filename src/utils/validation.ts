import { ApiError } from '../middleware/errorHandler';

/**
 * Validation utility functions
 */

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

export const validateRequired = (value: any, fieldName: string): void => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ApiError(400, `${fieldName} is required`, 'VALIDATION_ERROR', {
      field: fieldName,
    });
  }
};

export const validateEmailFormat = (email: string): void => {
  if (!validateEmail(email)) {
    throw new ApiError(400, 'Invalid email format', 'VALIDATION_ERROR', {
      field: 'email',
    });
  }
};

export const validatePasswordStrength = (password: string): void => {
  if (!validatePassword(password)) {
    throw new ApiError(
      400,
      'Password must be at least 8 characters',
      'VALIDATION_ERROR',
      {
        field: 'password',
      }
    );
  }
};

export const validateDate = (date: string, fieldName: string): void => {
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ApiError(400, `Invalid date format for ${fieldName}`, 'VALIDATION_ERROR', {
      field: fieldName,
    });
  }
};

export const validateYear = (year: number, fieldName: string): void => {
  const currentYear = new Date().getFullYear();
  if (year < 1000 || year > currentYear + 10) {
    throw new ApiError(
      400,
      `${fieldName} must be between 1000 and ${currentYear + 10}`,
      'VALIDATION_ERROR',
      {
        field: fieldName,
      }
    );
  }
};
