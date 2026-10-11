import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { Icon } from "../components/Icon";

export function NotFoundPage() {
  const { toast } = useApp();
  return (
    <div className="page">
      <div className="empty empty--404">
        <div className="empty__art empty__art--big">
          <Icon name="play" size={54} />
        </div>
        <h1>404 · This page wandered off</h1>
        <p className="muted">
          The link you followed doesn't exist on this clone. Let's get you back to something worth watching.
        </p>
        <div className="empty__suggestions">
          <Link className="btn btn--primary" to="/">
            Home
          </Link>
          <Link className="btn btn--outline" to="/feed/trending">
            Trending
          </Link>
          <Link className="btn btn--outline" to="/feed/library">
            Library
          </Link>
          <button className="btn btn--chip" onClick={() => toast("Report a broken link sent")}>
            Report a problem
          </button>
        </div>
      </div>
    </div>
  );
}
