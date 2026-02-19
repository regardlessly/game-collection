import PropTypes from 'prop-types';
import styles from './Button.module.css';

export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  autoFocus = false,
  ariaLabel,
  className = '',
}) {
  const sizeClass = size === 'large' ? styles.large : size === 'small' ? styles.small : '';

  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${sizeClass} ${className}`}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  autoFocus: PropTypes.bool,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};
