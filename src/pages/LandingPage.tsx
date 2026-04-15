import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, BookOpen, Users, Moon, Sun, Calendar, BarChart3, Trash2, Menu, X, Globe, Github, GraduationCap, ArrowUp } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const teamMembers = [
  { name: "Nguyễn Thị Yến Như", mssv: "030239230173", roleKey: "landing.team.leaderRole", initials: "NN" },
  { name: "Nguyễn Đoàn Nguyệt Hà", mssv: "030239230043", roleKey: "landing.team.backendRole", initials: "NH" },
  { name: "Trần Phan Ly Na", mssv: "030239230131", roleKey: "landing.team.frontendRole", initials: "LN" },
  { name: "Võ Hồng Quyên", mssv: "030239230201", roleKey: "landing.team.securityRole", initials: "VQ" },
  { name: "Võ Thị Vân Thư", mssv: "030239230235", roleKey: "landing.team.designerRole", initials: "VT" },
];

const features = [
  { icon: <Lock className="w-6 h-6" />, titleKey: "landing.features.rsa.title", descKey: "landing.features.rsa.description" },
  { icon: <BookOpen className="w-6 h-6" />, titleKey: "landing.features.editor.title", descKey: "landing.features.editor.description" },
  { icon: <Users className="w-6 h-6" />, titleKey: "landing.features.share.title", descKey: "landing.features.share.description" },
  { icon: <Calendar className="w-6 h-6" />, titleKey: "landing.features.calendar.title", descKey: "landing.features.calendar.description" },
  { icon: <BarChart3 className="w-6 h-6" />, titleKey: "landing.features.stats.title", descKey: "landing.features.stats.description" },
  { icon: <Trash2 className="w-6 h-6" />, titleKey: "landing.features.trash.title", descKey: "landing.features.trash.description" },
  { icon: <Shield className="w-6 h-6" />, titleKey: "landing.features.logout.title", descKey: "landing.features.logout.description" },
  { icon: <Moon className="w-6 h-6" />, titleKey: "landing.features.theme.title", descKey: "landing.features.theme.description" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const logoStyle = {
    filter:
      "drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff)",
  };

  const scrollTo = (id: string) => {
    setMobileMenu(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo-hub.webp"
              alt="Hub Logo"
              className="h-9 w-auto object-contain"
              style={logoStyle}
            />
            <span className="text-xl font-bold tracking-wider text-foreground">COZY</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.navFeatures")}</button>
            <button onClick={() => scrollTo("team")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("landing.navTeam")}</button>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                const newLang = i18n.language === "vi" ? "en" : "vi";
                i18n.changeLanguage(newLang);
                localStorage.setItem("i18nextLng", newLang);
              }}
              className="border border-gray-300 rounded-full px-3 py-1 flex items-center gap-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>{i18n.language === "vi" ? "EN" : "VN"}</span>
            </button>
            <button onClick={() => navigate("/auth")} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              {t("landing.login")}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                const newLang = i18n.language === "vi" ? "en" : "vi";
                i18n.changeLanguage(newLang);
                localStorage.setItem("i18nextLng", newLang);
              }}
              className="border border-gray-300 rounded-full px-3 py-1 flex items-center gap-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>{i18n.language === "vi" ? "EN" : "VN"}</span>
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden glass-card mx-4 mb-2 p-4 space-y-3 animate-fade-in">
            <button onClick={() => scrollTo("features")} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2">{t("landing.navFeatures")}</button>
            <button onClick={() => scrollTo("team")} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2">{t("landing.navTeam")}</button>
            <button onClick={() => { setMobileMenu(false); navigate("/auth"); }} className="w-full px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              {t("landing.login")}
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-2xl">
          <div className="mx-auto mb-8 flex items-center justify-center">
            <img
              src="/logo-hub.webp"
              alt="Hub Logo"
              className="h-24 w-auto object-contain"
              style={logoStyle}
            />
          </div>

          <h1 className="text-6xl sm:text-8xl font-bold tracking-widest text-foreground mb-5">
            COZY
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-3">
            {t("app.title")}
          </p>
          <p className="text-base text-muted-foreground mb-12 max-w-xl mx-auto leading-8">
            {t("landing.subtitle")}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              {t("landing.start")}
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition-colors"
            >
              {t("landing.learnMore")}
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-3">{t('landing.features.title')}</h2>
          <p className="text-center text-muted-foreground text-base leading-8 mb-14 max-w-2xl mx-auto">
            {t('landing.features.description')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-7 hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-3">{t(f.titleKey)}</h3>
                <p className="text-base text-muted-foreground leading-8">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-3">{t('landing.team.title')}</h2>
          <p className="text-center text-muted-foreground text-base mb-14">{t('landing.team.description')}</p>
          
          {/* Giảng viên hướng dẫn */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-primary/10 border border-primary/20">
              <GraduationCap className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">{t('landing.team.advisor')}:</span>
              <span className="text-base font-bold text-primary">{t('landing.team.advisorName')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
            {teamMembers.map((m, i) => (
              <div key={i} className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{m.initials}</span>
                </div>
                <h4 className="font-semibold text-foreground text-base leading-tight">{m.name}</h4>
                <p className="text-sm text-muted-foreground mt-2">MSSV: {m.mssv}</p>
                <p className="text-sm text-primary mt-2 leading-6">{t(m.roleKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/logo-hub.webp"
                alt="Hub Logo"
                className="h-6 w-auto object-contain"
                style={logoStyle}
              />
              <span className="font-bold tracking-wider text-foreground">COZY</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {t('landing.footer.appDescription')}
            </p>
            <a
              href="https://github.com/yuu-zu/cozy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              {t('landing.footer.github')}
            </a>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3">{t('landing.footer.university')}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('landing.footer.address')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3">Tài liệu</h4>
            <a
              href="https://docs.google.com/document/d/1DAtWSVkmxYRPYk9tytT1dYEHqgKiLEhYeOq1cTKo9aw/edit?tab=t.0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-block mb-2"
            >
              Giải thích Code
            </a>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3">{t('landing.footer.contact')}</h4>
            <p className="text-sm text-muted-foreground">{t('landing.footer.email')}</p>
            <p className="text-sm text-muted-foreground">{t('landing.footer.phone')}</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">{t('landing.footer.copyright')}</p>
        </div>
      </footer>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
        >
          <ArrowUp className="h-4 w-4" />
          {t("landing.scrollTop")}
        </button>
      )}
    </div>
  );
}
