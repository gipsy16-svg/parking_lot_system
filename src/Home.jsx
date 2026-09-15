import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Car,
  Check,
  CircleParking,
  Layers3,
  ListOrdered,
  MapPin,
  ReceiptText,
} from "lucide-react";
import { slotIds, TOTAL_SLOTS } from "./lib/parkingService";
import "./Home.css";

const features = [
  {
    icon: MapPin,
    title: "Every space, in sight.",
    text: "See occupied and available spaces in one clear view. Know exactly where the next vehicle can go.",
    link: "View parking slots",
    href: "#parking",
    tone: "sage",
  },
  {
    icon: ListOrdered,
    title: "Keep the line moving.",
    text: "Full lot? Add arrivals to the waiting queue. The next vehicle moves into a space when one opens up.",
    link: "See the waiting queue",
    href: "#queue",
    tone: "sand",
  },
  {
    icon: ReceiptText,
    title: "A record of every visit.",
    text: "Keep plate numbers, parking status, and entry and exit times together in an easy-to-read log.",
    link: "Explore parking records",
    href: "#records",
    tone: "blue",
  },
];

export default function Home() {
  return (
    <div className="home-page" id="home">
      <a className="home-skip-link" href="#home-main">
        Skip to content
      </a>
      <header className="home-header home-container">
        <a
          className="brand home-brand"
          href="#home"
          aria-label="Parkspace home"
        >
          <span className="brand-mark">
            <CircleParking size={25} aria-hidden="true" />
          </span>
          <span>
            parkspace<span className="brand-dot">.</span>
          </span>
        </a>
        <nav className="home-nav" aria-label="Homepage navigation">
          <a href="#features">Why Parkspace</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <a className="home-button home-button-small" href="#overview">
          Open dashboard <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </header>

      <main id="home-main">
        <section
          className="home-hero home-container"
          aria-labelledby="home-title"
        >
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <span /> A LITTLE ORDER. A LOT OF SPACE.
            </p>
            <h1 id="home-title">
              Less circling.
              <br />
              More <span>arriving.</span>
            </h1>
            <p className="home-intro">
              A calmer way to manage your parking lot. Welcome vehicles, find an
              open space, and keep every arrival and departure in order.
            </p>
            <div className="home-hero-actions">
              <a className="home-button" href="#overview">
                Go to dashboard <ArrowUpRight size={19} aria-hidden="true" />
              </a>
              <a className="home-text-link" href="#how-it-works">
                See how it works <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="home-hero-note">
              <span>
                <Check size={14} aria-hidden="true" /> Simple check-ins
              </span>
              <span>
                <Check size={14} aria-hidden="true" /> Organized spaces
              </span>
            </div>
          </div>

          <div
            className="home-visual"
            role="img"
            aria-label="An illustration of an organized parking lot with five spaces and a marked driving lane."
          >
            <div className="home-visual-orbit" />
            <div className="home-visual-caption">
              <span className="home-small-mark">
                <CircleParking size={17} />
              </span>{" "}
              GOOD THINGS START WITH A SPACE.
            </div>
            <div className="home-lot-illustration" aria-hidden="true">
              <div className="home-lot-label">
                <span>
                  <span /> MAIN PARKING LOT
                </span>
                <Layers3 size={17} />
              </div>
              <div className="home-illustrated-slots">
                {slotIds().map((slot, index) => (
                  <div
                    className={`home-illustrated-slot ${index === 1 || index === 4 ? "is-open" : "has-car"}`}
                    key={slot}
                  >
                    <span>{slot}</span>
                    {index === 1 || index === 4 ? (
                      <span className="home-parking-letter">P</span>
                    ) : (
                      <div
                        className={`vehicle-illustration home-car home-car-${index}`}
                      >
                        <span className="vehicle-windshield" />
                        <span className="vehicle-roof" />
                        <span className="vehicle-rear" />
                      </div>
                    )}
                    <i />
                  </div>
                ))}
              </div>
              <div className="home-illustrated-lane">
                <span>IN</span>
                <ArrowRight size={24} />
                <div />
                <ArrowRight size={24} />
                <span>OUT</span>
              </div>
              <div className="home-lot-bottom">
                <span>PARK EASY.</span>
                <span>KEEP MOVING.</span>
              </div>
            </div>
            <div className="home-arrival-card" aria-hidden="true">
              <span>
                <ArrowDownLeft size={22} />
              </span>
              <div>
                <strong>A smoother arrival.</strong>
                <p>From the gate to your space.</p>
              </div>
              <span className="home-arrival-check">
                <Check size={15} />
              </span>
            </div>
            <span className="home-illustration-label">ILLUSTRATED LOT</span>
          </div>
        </section>

        <div
          className="home-facts home-container"
          aria-label="System highlights"
        >
          <div>
            <CircleParking size={20} aria-hidden="true" />
            <span>
              <strong>{String(TOTAL_SLOTS).padStart(2, "0")}</strong> managed
              parking spaces
            </span>
          </div>
          <div>
            <Car size={20} aria-hidden="true" />
            <span>Cars, motorcycles, vans & trucks</span>
          </div>
          <div>
            <ListOrdered size={20} aria-hidden="true" />
            <span>Automatic queue promotion</span>
          </div>
        </div>

        <section
          className="home-features home-container"
          id="features"
          aria-labelledby="home-features-title"
        >
          <div className="home-section-heading">
            <div>
              <p className="home-eyebrow">A PLACE FOR EVERYTHING</p>
              <h2 id="home-features-title">Small lot. Thoughtfully managed.</h2>
            </div>
            <p>
              Less guesswork at the gate.
              <br />
              More clarity throughout the day.
            </p>
          </div>
          <div className="home-feature-grid">
            {features.map(({ icon: Icon, title, text, link, href, tone }) => (
              <article
                className={`home-feature home-feature-${tone}`}
                key={title}
              >
                <span className="home-feature-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <a className="home-text-link" href={href}>
                  {link}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section
          className="home-workflow home-container"
          id="how-it-works"
          aria-labelledby="home-workflow-title"
        >
          <div className="home-workflow-intro">
            <p className="home-eyebrow">FROM HELLO TO SEE YOU AGAIN</p>
            <h2 id="home-workflow-title">
              Three steps.
              <br />
              One smooth visit.
            </h2>
            <a className="home-text-link" href="#arrival">
              Register an arrival <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <ol className="home-steps">
            <li>
              <span className="home-step-number">01</span>
              <div>
                <h3>Welcome the vehicle</h3>
                <p>Enter the plate number, owner name, and vehicle type.</p>
              </div>
            </li>
            <li>
              <span className="home-step-number">02</span>
              <div>
                <h3>Give it a space</h3>
                <p>
                  Choose an available slot, or join the queue if the lot is
                  full.
                </p>
              </div>
            </li>
            <li>
              <span className="home-step-number">03</span>
              <div>
                <h3>Make way for the next arrival</h3>
                <p>
                  Check out with the plate number. The record updates and the
                  next waiting vehicle moves in.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section
          className="home-cta home-container"
          aria-labelledby="home-cta-title"
        >
          <div>
            <p className="home-eyebrow">YOUR LOT. ALL TOGETHER.</p>
            <h2 id="home-cta-title">Ready for the next arrival?</h2>
            <p>Your spaces, queue, and records are just a click away.</p>
          </div>
          <a className="home-button" href="#overview">
            Open dashboard <ArrowUpRight size={19} aria-hidden="true" />
          </a>
          <CircleParking
            className="home-cta-decoration"
            size={200}
            aria-hidden="true"
          />
        </section>
      </main>

      <footer className="home-footer home-container">
        <a className="home-footer-brand" href="#home">
          parkspace<span className="brand-dot">.</span>
        </a>
        <p>A smoother way to park.</p>
        <a href="#overview">
          Parking dashboard <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
