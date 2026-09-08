/**
 * The app's entire routing surface, in one file.
 *
 * Everything imports navigation from here, which is what made replacing
 * react-router with src/lib/router.tsx a one-file change (see ADR-1, revised).
 */
export { Link, useParams, useNavigate, Navigate, useLocation } from './router'
