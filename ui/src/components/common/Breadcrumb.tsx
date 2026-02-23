import { Link } from 'react-router-dom';

interface Crumb { label: string; path?: string; }

interface Props { crumbs: Crumb[]; }

export function Breadcrumb({ crumbs }: Props) {
  if (crumbs.length <= 1) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-3">
      <ol className="breadcrumb">
        {crumbs.map((crumb, i) => (
          <li key={i} className={`breadcrumb-item ${i === crumbs.length - 1 ? 'active' : ''}`}>
            {crumb.path && i < crumbs.length - 1
              ? <Link to={crumb.path} className="text-decoration-none">{crumb.label}</Link>
              : crumb.label
            }
          </li>
        ))}
      </ol>
    </nav>
  );
}
