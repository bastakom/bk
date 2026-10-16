-- Prisma lagrar DateTime som "timestamp without time zone" i UTC. All SQL som
-- jämför mot now() eller tidsparametrar (t.ex. workerns låsning av utskick)
-- måste därför köra med UTC som sessionstidszon, oavsett serverns inställning.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO ''UTC''', current_database()); END $$;
