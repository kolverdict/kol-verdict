INSERT INTO profiles (id, wallet_address, wallet_chain, username, avatar_url, reputation_score, influence_weight)
VALUES
  ('11111111-1111-1111-1111-111111111111', '7B1J4cGxLQ2VQ9xN8y4Qm9nVgQ4T8fjZg2YqSage1234', 'solana', 'cryptosage.eth', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmPX562-2UaZHoq68VdnFv8EFLe_OzmUb079GHlZPCnN4r0x-umCIBU1fEEBmTL_HbGe0VLYXG5UB_rwmXi0OFHEolx8WMPfqK_jw7JSs_EV3z1NPvyD94Or6XArB6tNSTybUUyvq-PvoSuE8fvAK5myc5VgbW7XITvejLIqHavQnp6vkh1xdF6heKsZ3St3dNRUX_SulKhZDcpiGR8oXVY93V78gfvNvRvzCiGZvC7vPgR3wAdbp-FFor1r6o3AbLi-aabUXJXyc', 84.2, 84.2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kols (id, slug, x_username, display_name, avatar_url, bio, initial_trust_score, status)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'cipher-nexus', 'cipher_nexus', 'Cipher_Nexus', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHF2xpTABunTpFGv6MvI9gqjGm1sd5jKgigNz7QpMZtq59SldQxM5iFuH-xqg97uCx1BBXyj_W3fIfdE2Y5OvP7rRhbPaVVNloDNPHnGAkY8Zgd0BRv6Cokaxq8lqeoluUvjK7igibvDYUM1FglmEK_nHZ3BCUvz6RadOCKGtsRV_QUF4uT30i0mz7v5gL2mX-920dvL9Bb70rfwJgngBs12fwsRaqGYmwCNNY-uNHq_WTF3wpi7hfsW5fcgeVvnrXzgiDeRWQ4eI', 'Known for clean technical breakdowns, early alpha calls, and disciplined on-chain verification.', 72, 'active')
ON CONFLICT (slug) DO NOTHING;

SELECT refresh_kol_metrics_cache('22222222-2222-2222-2222-222222222222');
-- NON-PRODUCTION FIXTURE.
-- Do not apply this seed file in production. Use it only for disposable local/demo environments.
