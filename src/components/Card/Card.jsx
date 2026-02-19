import PropTypes from 'prop-types';
import styles from './Card.module.css';

export function Card({ children, variant = 'default', className = '' }) {
  const variantClass =
    variant === 'elevated' ? styles.elevated : variant === 'flat' ? styles.flat : '';

  return (
    <div className={`${styles.card} ${variantClass} ${className}`}>
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'elevated', 'flat']),
  className: PropTypes.string,
};
