/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { subDays, addDays } from "date-fns";

const prisma = new PrismaClient();

function encryptSecret(plaintext: string): string {
  const keyHex = process.env.UNIT_SECRET_ENCRYPTION_KEY;
  if (!keyHex) throw new Error("UNIT_SECRET_ENCRYPTION_KEY no configurado; no se puede sembrar UnitSecret.");
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

async function main() {
  console.log("Sembrando datos demo (Andes Hospitality)...");

  const org = await prisma.organization.upsert({
    where: { slug: "andes-hospitality" },
    update: {},
    create: { name: "Andes Hospitality", slug: "andes-hospitality", timezone: "America/Santiago", locale: "es-CL", currency: "CLP" },
  });

  const passwordHash = await bcrypt.hash("Demo1234!", 10);
  await prisma.user.upsert({
    where: { email: "admin@andeshospitality.demo" },
    update: {},
    create: { email: "admin@andeshospitality.demo", passwordHash, name: "Admin Andes", role: "OWNER", organizationId: org.id },
  });
  await prisma.user.upsert({
    where: { email: "operaciones@andeshospitality.demo" },
    update: {},
    create: { email: "operaciones@andeshospitality.demo", passwordHash, name: "Equipo Operaciones", role: "MANAGER", organizationId: org.id },
  });

  const costaNorte = await prisma.property.upsert({
    where: { organizationId_internalCode: { organizationId: org.id, internalCode: "COSTA-NORTE" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Hotel Costa Norte",
      internalCode: "COSTA-NORTE",
      propertyType: "HOTEL",
      description: "Hotel boutique frente al mar en el norte de Chile.",
      address: "Av. Costanera 450",
      city: "Antofagasta",
      country: "Chile",
      timezone: "America/Santiago",
      locale: "es-CL",
      currency: "CLP",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      maximumGuests: 6,
      bedrooms: 3,
      bathrooms: 3,
      status: "ACTIVE",
      whatsappNumber: "+56900000001",
    },
  });

  const refugioLago = await prisma.property.upsert({
    where: { organizationId_internalCode: { organizationId: org.id, internalCode: "REFUGIO-LAGO" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Refugio Lago Azul",
      internalCode: "REFUGIO-LAGO",
      propertyType: "CABIN",
      description: "Cabana aislada frente al lago, ideal para desconexion.",
      address: "Camino al Lago Km 12",
      city: "Pucon",
      country: "Chile",
      timezone: "America/Santiago",
      locale: "es-CL",
      currency: "CLP",
      checkInTime: "16:00",
      checkOutTime: "11:00",
      maximumGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
      status: "ACTIVE",
      whatsappNumber: "+56900000002",
    },
  });

  async function upsertUnit(propertyId: string, code: string, data: Omit<Parameters<typeof prisma.unit.create>[0]["data"], "propertyId" | "code">) {
    const existing = await prisma.unit.findFirst({ where: { propertyId, code } });
    if (existing) return prisma.unit.update({ where: { id: existing.id }, data });
    return prisma.unit.create({ data: { propertyId, code, ...data } });
  }

  const grandSuite = await upsertUnit(costaNorte.id, "301", { name: "Grand Suite 301", category: "GRAND_SUITE", maximumGuests: 4, basePrice: 180000, cleaningFee: 25000, description: "Suite con vista al mar y jacuzzi privado." });
  const deluxe = await upsertUnit(costaNorte.id, "205", { name: "Deluxe 205", category: "DELUXE", maximumGuests: 3, basePrice: 120000, cleaningFee: 18000, description: "Habitacion deluxe con balcon." });
  const standard = await upsertUnit(costaNorte.id, "108", { name: "Standard 108", category: "STANDARD", maximumGuests: 2, basePrice: 75000, cleaningFee: 12000, description: "Habitacion estandar confortable." });
  const cabana = await upsertUnit(refugioLago.id, "CABANA-1", { name: "Cabana completa", category: "HOUSE", maximumGuests: 4, basePrice: 140000, cleaningFee: 20000, description: "Cabana completa de 2 dormitorios frente al lago." });

  // Door code secrets (encrypted) for two units.
  const existingSecret = await prisma.unitSecret.findFirst({ where: { unitId: grandSuite.id, secretType: "DOOR_CODE" } });
  if (!existingSecret) {
    await prisma.unitSecret.create({
      data: { unitId: grandSuite.id, secretType: "DOOR_CODE", encryptedValue: encryptSecret("4521#"), visibleFrom: new Date(), visibleUntil: addDays(new Date(), 60) },
    });
  }
  const existingSecret2 = await prisma.unitSecret.findFirst({ where: { unitId: cabana.id, secretType: "DOOR_CODE" } });
  if (!existingSecret2) {
    await prisma.unitSecret.create({
      data: { unitId: cabana.id, secretType: "DOOR_CODE", encryptedValue: encryptSecret("7788#"), visibleFrom: new Date(), visibleUntil: addDays(new Date(), 60) },
    });
  }

  async function upsertGuest(phone: string, data: Omit<Parameters<typeof prisma.guest.create>[0]["data"], "organizationId" | "phone">) {
    const existing = await prisma.guest.findFirst({ where: { organizationId: org.id, phone } });
    if (existing) return prisma.guest.update({ where: { id: existing.id }, data });
    return prisma.guest.create({ data: { organizationId: org.id, phone, ...data } });
  }

  const guest1 = await upsertGuest("+56911111111", { firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@example.com", preferredLanguage: "es" });
  const guest2 = await upsertGuest("+15551234567", { firstName: "John", lastName: "Smith", email: "john.smith@example.com", preferredLanguage: "en" });

  async function upsertReservation(guestId: string, unitId: string, propertyId: string, checkIn: Date, checkOut: Date, status: any, source: any) {
    const existing = await prisma.reservation.findFirst({ where: { guestId, unitId, checkIn } });
    const basePrice = unitId === grandSuite.id ? 180000 : unitId === deluxe.id ? 120000 : unitId === standard.id ? 75000 : 140000;
    const cleaningFee = unitId === grandSuite.id ? 25000 : unitId === deluxe.id ? 18000 : unitId === standard.id ? 12000 : 20000;
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
    const subtotal = nights * basePrice;
    const totalAmount = subtotal + cleaningFee;
    const data = { organizationId: org.id, propertyId, unitId, guestId, checkIn, checkOut, adults: 2, children: 0, totalGuests: 2, subtotal, taxes: 0, fees: 0, totalAmount, amountPaid: status === "CONFIRMED" ? totalAmount : 0, currency: "CLP", status, source };
    if (existing) return prisma.reservation.update({ where: { id: existing.id }, data });
    return prisma.reservation.create({ data });
  }

  const today = new Date();
  const res1 = await upsertReservation(guest1.id, grandSuite.id, costaNorte.id, addDays(today, 1), addDays(today, 4), "CONFIRMED", "DIRECT");
  await upsertReservation(guest2.id, deluxe.id, costaNorte.id, addDays(today, 2), addDays(today, 5), "CONFIRMED", "AIRBNB");
  await upsertReservation(guest1.id, cabana.id, refugioLago.id, subDays(today, 10), subDays(today, 6), "CHECKED_OUT", "WHATSAPP");

  // Conversations + messages (5 total).
  async function upsertConversation(propertyId: string, guestId: string, channel: any, status: any) {
    const existing = await prisma.conversation.findFirst({ where: { propertyId, guestId, channel } });
    if (existing) return existing;
    return prisma.conversation.create({ data: { organizationId: org.id, propertyId, guestId, channel, status, lastMessageAt: new Date() } });
  }

  const convo1 = await upsertConversation(costaNorte.id, guest1.id, "WHATSAPP", "OPEN");
  const convo2 = await upsertConversation(costaNorte.id, guest2.id, "WHATSAPP", "PENDING_HUMAN");
  const convo3 = await upsertConversation(refugioLago.id, guest1.id, "WHATSAPP", "CLOSED");
  const convo4 = await upsertConversation(costaNorte.id, guest2.id, "EMAIL", "OPEN");
  const convo5 = await upsertConversation(refugioLago.id, guest2.id, "WHATSAPP", "ESCALATED");

  async function ensureMessages(conversationId: string, pairs: Array<{ sender: any; content: string }>) {
    const count = await prisma.message.count({ where: { conversationId } });
    if (count > 0) return;
    for (const pair of pairs) {
      await prisma.message.create({ data: { conversationId, senderType: pair.sender, content: pair.content, messageType: "TEXT", aiGenerated: pair.sender === "AGENT" } });
    }
  }

  await ensureMessages(convo1.id, [
    { sender: "GUEST", content: "Hola! Quiero reservar la Grand Suite para el fin de semana." },
    { sender: "AGENT", content: "Hola Maria, con gusto. Ya tengo tu reserva confirmada, cualquier cosa avisame." },
  ]);
  await ensureMessages(convo2.id, [
    { sender: "GUEST", content: "Hi, does the room have air conditioning?" },
    { sender: "AGENT", content: "Yes! All Deluxe rooms include air conditioning and a private balcony." },
  ]);
  await ensureMessages(convo3.id, [{ sender: "GUEST", content: "Gracias por todo, la pasamos increible en la cabana." }]);
  await ensureMessages(convo4.id, [{ sender: "GUEST", content: "Consulta por facturacion de la reserva pasada." }]);
  await ensureMessages(convo5.id, [{ sender: "GUEST", content: "Huelo a gas en la cabana, ayuda urgente!" }]);

  // Services (4).
  async function upsertService(propertyId: string, name: string, data: any) {
    const existing = await prisma.service.findFirst({ where: { propertyId, name } });
    if (existing) return existing;
    return prisma.service.create({ data: { propertyId, name, ...data } });
  }
  await upsertService(costaNorte.id, "Masaje relajante 60min", { category: "SPA", price: 45000, currency: "CLP", durationMinutes: 60 });
  await upsertService(costaNorte.id, "Transporte aeropuerto", { category: "TRANSPORT", price: 25000, currency: "CLP" });
  await upsertService(costaNorte.id, "Late checkout (hasta 14:00)", { category: "LATE_CHECKOUT", price: 15000, currency: "CLP", requiresApproval: true });
  await upsertService(refugioLago.id, "Tour kayak en el lago", { category: "TOUR", price: 35000, currency: "CLP", capacity: 4 });

  // Contractors (3).
  async function upsertContractor(name: string, data: any) {
    const existing = await prisma.contractor.findFirst({ where: { organizationId: org.id, name } });
    if (existing) return existing;
    return prisma.contractor.create({ data: { organizationId: org.id, name, ...data } });
  }
  await upsertContractor("Electricidad Rapida SpA", { company: "Electricidad Rapida", phone: "+56922222222", specialties: ["ELECTRICAL"], regions: ["Antofagasta"], hourlyRate: 20000, rating: 4.7 });
  await upsertContractor("Gasfiteria Pucon", { company: "Gasfiteria Pucon Ltda", phone: "+56933333333", specialties: ["PLUMBING"], regions: ["Pucon"], hourlyRate: 18000, rating: 4.5 });
  await upsertContractor("TecniHogar Wifi & Electro", { company: "TecniHogar", phone: "+56944444444", specialties: ["WIFI", "APPLIANCE"], regions: ["Antofagasta", "Pucon"], hourlyRate: 15000, rating: 4.2 });

  // Knowledge documents (5) + resources (3).
  async function upsertDoc(propertyId: string | null, title: string, category: string, content: string) {
    const existing = await prisma.knowledgeDocument.findFirst({ where: { organizationId: org.id, title } });
    if (existing) return existing;
    return prisma.knowledgeDocument.create({ data: { organizationId: org.id, propertyId, title, category, content, sourceType: "MANUAL_ENTRY" } });
  }
  const doc1 = await upsertDoc(costaNorte.id, "Horarios de check-in y check-out", "Politicas", "Check-in desde las 15:00. Check-out hasta las 11:00. Late checkout disponible con costo adicional sujeto a disponibilidad.");
  await upsertDoc(costaNorte.id, "Wifi del hotel", "Tecnico", "Red: CostaNorte-Guest. Clave: bienvenido2026. Si no conecta, reinicia el router del pasillo (10 segundos).");
  await upsertDoc(refugioLago.id, "Como llegar a Refugio Lago Azul", "Ubicacion", "Camino al Lago Km 12, Pucon. Ultimos 2km son de ripio, se recomienda vehiculo alto.");
  await upsertDoc(null, "Politica de mascotas", "Politicas", "Se aceptan mascotas pequenas con cargo adicional de 15000 CLP por estadia, previa autorizacion.");
  await upsertDoc(costaNorte.id, "Emergencias y seguridad", "Seguridad", "En caso de emergencia de riesgo vital (incendio, gas, inundacion, intrusion, emergencia medica) contacta inmediatamente a Carabineros (133) o Bomberos (132) y luego a recepcion.");

  async function upsertResource(documentId: string, title: string, resourceType: any) {
    const existing = await prisma.knowledgeResource.findFirst({ where: { documentId, title } });
    if (existing) return existing;
    return prisma.knowledgeResource.create({ data: { documentId, title, resourceType, url: "https://example.com/placeholder.jpg", description: "Recurso visual de referencia (demo)." } });
  }
  await upsertResource(doc1.id, "Foto lobby check-in", "IMAGE");
  await upsertResource(doc1.id, "Video bienvenida", "VIDEO");
  await upsertResource(doc1.id, "Mapa del hotel (PDF)", "PDF");

  // Maintenance tickets (2).
  async function upsertTicket(propertyId: string, unitId: string, title: string, data: any) {
    const existing = await prisma.maintenanceTicket.findFirst({ where: { organizationId: org.id, propertyId, unitId, title } });
    if (existing) return existing;
    return prisma.maintenanceTicket.create({ data: { organizationId: org.id, propertyId, unitId, title, ...data } });
  }
  await upsertTicket(costaNorte.id, deluxe.id, "Wifi intermitente en Deluxe 205", { description: "El wifi se corta cada 20 minutos.", category: "WIFI", urgency: "MEDIUM", status: "OPEN", source: "GUEST_REPORT" });
  await upsertTicket(refugioLago.id, cabana.id, "Posible olor a gas reportado", { description: "Huesped reporto olor a gas en la cocina.", category: "SAFETY", urgency: "CRITICAL", status: "OPEN", source: "GUEST_REPORT" });

  // Competitors (3) + reviews (10).
  async function upsertCompetitor(propertyId: string, name: string, data: any) {
    const existing = await prisma.competitor.findFirst({ where: { organizationId: org.id, propertyId, name } });
    if (existing) return existing;
    return prisma.competitor.create({ data: { organizationId: org.id, propertyId, name, ...data } });
  }
  const comp1 = await upsertCompetitor(costaNorte.id, "Hotel Pacifico Sur", { platform: "Booking", location: "Antofagasta", threatScore: 62 });
  const comp2 = await upsertCompetitor(costaNorte.id, "Costa Azul Apart Hotel", { platform: "Airbnb", location: "Antofagasta", threatScore: 48 });
  const comp3 = await upsertCompetitor(refugioLago.id, "Cabanas del Bosque Pucon", { platform: "Airbnb", location: "Pucon", threatScore: 55 });

  await prisma.competitorSnapshot.createMany({
    data: [
      { competitorId: comp1.id, nightlyPrice: 95000, rating: 4.3, reviewCount: 210, amenities: ["piscina", "desayuno"] },
      { competitorId: comp2.id, nightlyPrice: 88000, rating: 4.1, reviewCount: 140, amenities: ["cocina", "wifi"] },
      { competitorId: comp3.id, nightlyPrice: 110000, rating: 4.6, reviewCount: 95, amenities: ["vista al lago", "tinaja"] },
    ],
    skipDuplicates: true,
  });

  const reviewTexts = [
    "Excelente ubicacion, muy cerca de la playa.",
    "El desayuno fue muy pobre para el precio que pagamos.",
    "Personal muy amable, volveria sin dudar.",
    "El wifi era muy lento durante toda la estadia.",
    "Habitaciones amplias y limpias, recomendado.",
    "El check-in demoro mas de una hora, mala organizacion.",
    "Vista espectacular al lago, superó nuestras expectativas.",
    "El estacionamiento es muy reducido para la cantidad de huespedes.",
    "Buena relacion precio-calidad en general.",
    "La piscina estaba cerrada sin previo aviso.",
  ];
  const competitorsList = [comp1, comp2, comp3];
  for (let i = 0; i < reviewTexts.length; i++) {
    const competitor = competitorsList[i % competitorsList.length];
    const existing = await prisma.competitorReview.findFirst({ where: { competitorId: competitor.id, reviewText: reviewTexts[i] } });
    if (!existing) {
      await prisma.competitorReview.create({
        data: {
          competitorId: competitor.id,
          rating: 3 + (i % 3),
          reviewText: reviewTexts[i],
          sentiment: i % 3 === 0 ? "negative" : "positive",
          extractedAmenities: [],
          extractedPainPoints: i % 3 === 0 ? [reviewTexts[i]] : [],
        },
      });
    }
  }

  // Daily metrics (last 10 days) for both properties.
  for (let i = 0; i < 10; i++) {
    const date = subDays(today, i);
    for (const property of [costaNorte, refugioLago]) {
      const existing = await prisma.dailyMetric.findFirst({ where: { organizationId: org.id, propertyId: property.id, date } });
      if (existing) continue;
      await prisma.dailyMetric.create({
        data: {
          organizationId: org.id,
          propertyId: property.id,
          date,
          conversationsHandled: 3 + (i % 4),
          reservationsCreated: i % 3 === 0 ? 1 : 0,
          ticketsCreated: i % 5 === 0 ? 1 : 0,
          humanEscalations: i % 4 === 0 ? 1 : 0,
          upsellRevenue: (i % 3) * 25000,
          estimatedHumanMinutesSaved: 40 + i * 3,
          aiCost: 0.02 + i * 0.001,
        },
      });
    }
  }

  // Per-organization AI persona name (BrandProfile.assistantName), demonstrating that the
  // assistant's guest-facing name is a configurable per-tenant feature, distinct from the
  // "Nexvore" platform brand shown in the dashboard. Andes Hospitality explicitly overrides it
  // to "Sofia"; Demo Bistro (below) intentionally leaves it unset so it falls back to the
  // code-level default ("Valentina", see prompts/base.ts) -- both paths are exercised on purpose.
  const existingAndesBrand = await prisma.brandProfile.findFirst({ where: { organizationId: org.id, propertyId: null } });
  if (!existingAndesBrand) {
    await prisma.brandProfile.create({ data: { organizationId: org.id, assistantName: "Sofia", tone: "calido y profesional" } });
  }

  console.log("Seed completado (Andes Hospitality).");
  console.log(`Organizacion: ${org.name} (${org.slug})`);
  console.log("Usuarios demo: admin@andeshospitality.demo / operaciones@andeshospitality.demo, password: Demo1234!");
  console.log(`WhatsApp de prueba -> Hotel Costa Norte: ${costaNorte.whatsappNumber}, Refugio Lago Azul: ${refugioLago.whatsappNumber}`);

  // ============================================================
  // DEMO BISTRO -- second demo organization, RESTAURANT vertical
  // ============================================================
  // Intentionally a generic placeholder name (NOT the real prospect's name -- the owner was
  // explicit about that). Demonstrates table reservations (Unit.category = "TABLE",
  // Property.propertyType = "RESTAURANT") running side by side with the hospitality-stay
  // vertical above, under the same multi-tenant platform.
  console.log("Sembrando datos demo (Demo Bistro)...");

  const bistroOrg = await prisma.organization.upsert({
    where: { slug: "demo-bistro" },
    update: {},
    create: { name: "Demo Bistro", slug: "demo-bistro", timezone: "America/Santiago", locale: "es-CL", currency: "CLP" },
  });

  await prisma.user.upsert({
    where: { email: "admin@demobistro.demo" },
    update: {},
    create: { email: "admin@demobistro.demo", passwordHash, name: "Admin Demo Bistro", role: "OWNER", organizationId: bistroOrg.id },
  });

  const bistro = await prisma.property.upsert({
    where: { organizationId_internalCode: { organizationId: bistroOrg.id, internalCode: "BISTRO-CENTRO" } },
    update: {},
    create: {
      organizationId: bistroOrg.id,
      name: "Demo Bistro Centro",
      internalCode: "BISTRO-CENTRO",
      propertyType: "RESTAURANT",
      description: "Restaurante de cocina de autor en pleno centro.",
      address: "Calle Principal 123",
      city: "Santiago",
      country: "Chile",
      timezone: "America/Santiago",
      locale: "es-CL",
      currency: "CLP",
      lunchOpen: "12:30",
      lunchClose: "16:00",
      dinnerOpen: "19:30",
      dinnerClose: "23:30",
      closedWeekdays: [1], // closed Mondays (JS Date#getDay(): 0=Sunday..6=Saturday)
      reservationDurationMinutes: 120,
      maximumGuests: 6,
      status: "ACTIVE",
      whatsappNumber: "+56900000003",
    },
  });

  const mesa1 = await upsertUnit(bistro.id, "MESA-1", { name: "Mesa 1 (ventana)", category: "TABLE", maximumGuests: 2, basePrice: 0, cleaningFee: 0, description: "Mesa para 2 junto a la ventana." });
  const mesa2 = await upsertUnit(bistro.id, "MESA-2", { name: "Mesa 2", category: "TABLE", maximumGuests: 4, basePrice: 0, cleaningFee: 0, description: "Mesa para 4 en el salon principal." });
  const mesa3 = await upsertUnit(bistro.id, "MESA-3-TERRAZA", { name: "Mesa 3 (terraza)", category: "TABLE", maximumGuests: 6, basePrice: 5000, cleaningFee: 0, description: "Mesa de terraza para grupos grandes, reserva con tarifa fija de garantia (no reembolsable)." });

  async function upsertBistroGuest(phone: string, data: Omit<Parameters<typeof prisma.guest.create>[0]["data"], "organizationId" | "phone">) {
    const existing = await prisma.guest.findFirst({ where: { organizationId: bistroOrg.id, phone } });
    if (existing) return prisma.guest.update({ where: { id: existing.id }, data });
    return prisma.guest.create({ data: { organizationId: bistroOrg.id, phone, ...data } });
  }

  const bistroGuest1 = await upsertBistroGuest("+56955555555", { firstName: "Camila", lastName: "Fuentes", email: "camila.fuentes@example.com", preferredLanguage: "es" });
  const bistroGuest2 = await upsertBistroGuest("+56966666666", { firstName: "Diego", lastName: "Torres", email: "diego.torres@example.com", preferredLanguage: "es" });

  /** Next date at least `daysFromToday` out that isn't a closed weekday (Monday=1 above). */
  function nextOpenDate(daysFromToday: number, hour: number, minute: number): Date {
    let d = addDays(today, daysFromToday);
    while (d.getDay() === 1) d = addDays(d, 1);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0);
  }

  const lunchSlot = nextOpenDate(1, 13, 30); // lunch service (12:30-16:00)
  const dinnerSlot = nextOpenDate(2, 20, 30); // dinner service (19:30-23:30)
  const dinnerSlot2 = nextOpenDate(2, 21, 0); // same evening, different table -- must NOT conflict

  async function upsertBistroReservation(guestId: string, unitId: string, start: Date, partySize: number, flatFee: number, notes: string) {
    const end = new Date(start.getTime() + 120 * 60000); // reservationDurationMinutes
    const existing = await prisma.reservation.findFirst({ where: { guestId, unitId, checkIn: start } });
    const data = {
      organizationId: bistroOrg.id,
      propertyId: bistro.id,
      unitId,
      guestId,
      checkIn: start,
      checkOut: end,
      adults: partySize,
      children: 0,
      totalGuests: partySize,
      subtotal: flatFee,
      taxes: 0,
      fees: 0,
      totalAmount: flatFee,
      amountPaid: 0,
      currency: "CLP",
      status: "CONFIRMED" as const,
      source: "WHATSAPP" as const,
      specialRequests: notes,
    };
    if (existing) return prisma.reservation.update({ where: { id: existing.id }, data });
    return prisma.reservation.create({ data });
  }

  await upsertBistroReservation(bistroGuest1.id, mesa1.id, lunchSlot, 2, 0, "Ninguna");
  await upsertBistroReservation(bistroGuest2.id, mesa2.id, dinnerSlot, 4, 0, "Alergia al mani");
  await upsertBistroReservation(bistroGuest1.id, mesa3.id, dinnerSlot2, 5, 5000, "Cumpleanos, mesa en la terraza si es posible");

  async function upsertBistroConversation(guestId: string, status: any) {
    const existing = await prisma.conversation.findFirst({ where: { propertyId: bistro.id, guestId, channel: "WHATSAPP" } });
    if (existing) return existing;
    return prisma.conversation.create({ data: { organizationId: bistroOrg.id, propertyId: bistro.id, guestId, channel: "WHATSAPP", status, lastMessageAt: new Date() } });
  }

  const bistroConvo1 = await upsertBistroConversation(bistroGuest1.id, "CLOSED");
  const bistroConvo2 = await upsertBistroConversation(bistroGuest2.id, "OPEN");

  await ensureMessages(bistroConvo1.id, [
    { sender: "GUEST", content: "Hola! Quiero reservar una mesa para 2 manana al mediodia." },
    { sender: "AGENT", content: "Hola! Soy Valentina 😊 ¿Cual es tu nombre completo?" },
    { sender: "GUEST", content: "Camila Fuentes" },
    { sender: "AGENT", content: "Genial Camila, tengo mesa disponible manana 13:30 para 2 personas. ¿Alguna alergia, restriccion o pedido especial?" },
    { sender: "GUEST", content: "Ninguna" },
    { sender: "AGENT", content: "Entonces te confirmo: Camila, 2 personas, manana a las 13:30, sin alergias. ¿Lo dejo agendado?" },
    { sender: "GUEST", content: "Si, confirmo" },
    { sender: "AGENT", content: "Tu mesa quedo reservada. ¡Te esperamos! 🍽️✅" },
  ]);
  await ensureMessages(bistroConvo2.id, [
    { sender: "GUEST", content: "Hola, tienen mesa para 4 personas el sabado en la noche?" },
    { sender: "AGENT", content: "Hola! Soy Valentina, con gusto te ayudo 😊 ¿Cual es tu nombre completo?" },
  ]);

  console.log("Seed completado (Demo Bistro).");
  console.log(`Organizacion: ${bistroOrg.name} (${bistroOrg.slug})`);
  console.log("Usuario demo: admin@demobistro.demo, password: Demo1234!");
  console.log(`WhatsApp de prueba -> Demo Bistro Centro: ${bistro.whatsappNumber}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
