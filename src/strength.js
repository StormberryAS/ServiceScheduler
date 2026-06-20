;(function () {
  const SB = (globalThis.SB ||= {});
  const passwordStrength = (pw) => {
    if (!pw) return 'unprotected';
    let classes = 0;
    if (/[a-z]/.test(pw)) classes++;
    if (/[A-Z]/.test(pw)) classes++;
    if (/[0-9]/.test(pw)) classes++;
    if (/[^A-Za-z0-9]/.test(pw)) classes++;
    const n = pw.length;
    if (n < 8 || classes <= 1) return 'weak';
    if (n >= 16 && classes >= 3) return 'super-strong';
    if (n >= 12 && classes >= 3) return 'strong';
    return 'medium';
  };
  SB.strength = { passwordStrength };
})();
