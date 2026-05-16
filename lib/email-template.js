'use strict';

/**
 * Nexvore premium HTML email template.
 * All styles are inline for maximum email client compatibility.
 *
 * @param {string} firstName - Buyer's first name
 * @returns {string} Full HTML string ready to send
 */
module.exports = function emailTemplate(firstName) {
  const zipLink = process.env.DRIVE_LINK_ZIP || '#';
  const pdfLink = process.env.DRIVE_LINK_PDF || '#';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Tu acceso a Nexvore está listo</title>
</head>
<body style="margin:0;padding:0;background-color:#0e0e18;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0e0e18;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#13131f;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);">

          <!-- ===== HEADER ===== -->
          <tr>
            <td align="center" style="padding:36px 40px 24px 40px;background-color:#0a0a14;">
              <p style="margin:0;font-size:32px;font-weight:900;letter-spacing:6px;color:#ffffff;text-transform:uppercase;line-height:1;">NEXVORE</p>
              <p style="margin:6px 0 0 0;font-size:12px;font-weight:600;letter-spacing:3px;color:#e00363;text-transform:uppercase;">Digital Studio</p>
            </td>
          </tr>

          <!-- Gradient separator line -->
          <tr>
            <td height="3" style="background:linear-gradient(90deg,#e00363 0%,#7b2fff 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ===== MAIN CONTENT ===== -->
          <tr>
            <td style="padding:44px 40px 36px 40px;">

              <!-- Headline -->
              <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">
                ¡Tu acceso está listo, ${firstName}!
              </h1>

              <!-- Intro paragraph -->
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.7;color:#b8b4cc;">
                Gracias por adquirir el pack de Nexvore Digital Studio. Tu compra fue procesada con éxito y tus recursos están disponibles para descarga inmediata. Encontrarás el pack de assets y la guía en PDF con todo lo que necesitas para lanzar tu proyecto digital.
              </p>

              <!-- Download button 1 -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
                <tr>
                  <td align="center" style="border-radius:50px;background:linear-gradient(90deg,#e00363 0%,#7b2fff 100%);">
                    <a href="${zipLink}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;letter-spacing:0.3px;">
                      ⬇ Descargar Pack de Assets (.zip)
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Download button 2 -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius:50px;background:linear-gradient(90deg,#e00363 0%,#7b2fff 100%);">
                    <a href="${pdfLink}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;letter-spacing:0.3px;">
                      ⬇ Descargar Guía PDF
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry note -->
              <p style="margin:0;font-size:12px;color:#6b677e;font-style:italic;">
                ⚠ Los enlaces de descarga están disponibles por 30 días desde la fecha de tu compra.
              </p>

            </td>
          </tr>

          <!-- Thin inner divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#1e1e30;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- ===== SUPPORT SECTION ===== -->
          <tr>
            <td style="padding:32px 40px 36px 40px;">
              <p style="margin:0 0 18px 0;font-size:16px;font-weight:700;color:#ffffff;">¿Necesitás ayuda?</p>
              <p style="margin:0 0 20px 0;font-size:14px;color:#b8b4cc;line-height:1.6;">
                Nuestro equipo está disponible para ayudarte. Contáctanos por WhatsApp o síguenos en Instagram.
              </p>

              <!-- WhatsApp button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
                <tr>
                  <td align="center" style="border-radius:50px;background-color:#25d366;">
                    <a href="https://wa.me/56945076214"
                       target="_blank"
                       style="display:inline-block;padding:11px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;">
                      💬 WhatsApp: +56 9 4507 6214
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instagram button -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:50px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);">
                    <a href="https://instagram.com/nexvorecl"
                       target="_blank"
                       style="display:inline-block;padding:11px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;">
                      📸 @nexvorecl
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="padding:20px 40px 28px 40px;background-color:#0a0a14;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4a4660;line-height:1.8;">
                © 2025 Nexvore Digital Studio &nbsp;·&nbsp;
                <a href="https://nex-vore.com" style="color:#7b2fff;text-decoration:none;">nex-vore.com</a>
                &nbsp;·&nbsp;
                <a href="https://nex-vore.com/unsubscribe" style="color:#4a4660;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
};
